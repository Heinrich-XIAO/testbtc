import { Command } from 'commander';
import kleur from 'kleur';
import { loadStoredData } from '../src/backtest/engine';
import { DifferentialEvolutionOptimizer } from '../src/optimization';
import type { OptimizationResult } from '../src/optimization/types';
import type { StoredData } from '../src/types';
import { BacktestEngine } from '../src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

// Auto-discover strategy configs from .optimization.ts files
function discoverStrategyConfigs(): Record<string, any> {
  const configs: Record<string, any> = {};
  const strategiesDir = path.join(__dirname, '../src/strategies');
  
  try {
    const files = fs.readdirSync(strategiesDir);
    for (const file of files) {
      if (!file.endsWith('.optimization.ts')) continue;
      const baseName = file.replace('.optimization.ts', '');
      try {
        const configModule = require(path.join(strategiesDir, file));
        if (configModule.optimizationConfig && configModule.outputFile) {
          let StrategyClass: any = configModule.StrategyClass || null;
          if (!StrategyClass) {
            try {
              const strategyModule = require(path.join(strategiesDir, `${baseName}.ts`));
              const className = baseName.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
                .split('').map((c: string, i: number) => i === 0 ? c.toUpperCase() : c).join('') + 'Strategy';
              StrategyClass = strategyModule[className] || strategyModule.default;
            } catch (e) { /* ignore */ }
          }
          if (StrategyClass) {
            configs[baseName] = {
              class: StrategyClass,
              params: configModule.optimizationConfig,
              outputFile: configModule.outputFile
            };
          }
        }
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
  
  return configs;
}

const discoveredStrategies = discoverStrategyConfigs();

// Use only discovered strategies (auto-discovered from .optimization.ts files)
const strategies = discoveredStrategies;
const availableStrategyNames = Object.keys(strategies).sort();
const defaultStrategyName = availableStrategyNames.includes('simple_ma')
  ? 'simple_ma'
  : (availableStrategyNames[0] ?? '');

async function loadDataset(datasetPath: string): Promise<StoredData> {
  const absolutePath = path.resolve(datasetPath);
  console.log(kleur.gray(`Loading dataset from: ${absolutePath}`));
  const data = await loadStoredData(absolutePath);
  console.log(kleur.gray(`Loaded ${data.markets.length} markets, ${data.priceHistory.size} price histories`));
  return data;
}

async function runOptimization(
  strategyName: string,
  data: StoredData,
  options: { generations: number; population: number }
): Promise<OptimizationResult> {
  const strategyConfig = strategies[strategyName];
  if (!strategyConfig) throw new Error(`Unknown strategy: ${strategyName}`);

  console.log(kleur.cyan(`\nOptimizing ${strategyName}...`));
  console.log(kleur.gray(`Generations: ${options.generations}, Population: ${options.population}`));

  const optimizer = new DifferentialEvolutionOptimizer(
    data,
    strategyConfig.class,
    strategyConfig.params,
    { maxIterations: options.generations }
  );

  const result = await optimizer.optimize(null);
  
  console.log(kleur.green(`\nBest result: Return = $${result.bestReturn.toFixed(2)}`));
  console.log(kleur.gray(`Best params: ${JSON.stringify(result.finalParams, null, 2)}`));

  const outputPath = path.join(__dirname, '../src/strategies', strategyConfig.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(result.finalParams, null, 2));

  return result;
}

async function runBacktest(
  strategyName: string,
  data: StoredData,
  params?: Record<string, number>
): Promise<void> {
  const strategyConfig = strategies[strategyName];
  if (!strategyConfig) throw new Error(`Unknown strategy: ${strategyName}`);

  const strategy = new strategyConfig.class(params || {});
  const engine = new BacktestEngine(data, strategy);
  const result = engine.run();

  console.log(kleur.cyan(`\nBacktest results for ${strategyName}:`));
  console.log(kleur.white(`  Final Capital: $${result.finalCapital.toFixed(2)}`));
  console.log(kleur.white(`  Total Return: $${result.totalReturn.toFixed(2)} (${result.totalReturnPercent.toFixed(2)}%)`));
  console.log(kleur.white(`  Total Trades: ${result.totalTrades}`));
  console.log(kleur.white(`  Win Rate: ${result.totalTrades > 0 ? ((result.winningTrades / result.totalTrades) * 100).toFixed(1) : 0}%`));
}

async function main() {
  const program = new Command();
  program
    .name('run-optimization')
    .argument('[strategy]', 'Strategy name', defaultStrategyName)
    .option('-d, --dataset <path>', 'Path to dataset', 'data/stock-data.json')
    .option('-g, --generations <number>', 'Number of generations', '5')
    .option('-p, --population <number>', 'Population size', '10')
    .option('--fast', 'Fast mode (3 generations, 8 population)', false)
    .option('--backtest-only', 'Run backtest only', false)
    .parse(process.argv);

  const options = program.opts();
  const strategyName = program.args[0] || defaultStrategyName;

  if (!strategyName) {
    throw new Error('No strategies discovered. Add strategy and .optimization.ts files in src/strategies.');
  }

  // Fast mode overrides
  let generations = parseInt(options.generations);
  let population = parseInt(options.population);
  if (options.fast) {
    generations = 3;
    population = 8;
  }

  try {
    const data = await loadDataset(options.dataset);

    if (options.backtestOnly) {
      const paramsPath = path.join(__dirname, '../src/strategies', strategies[strategyName].outputFile);
      let params = {};
      if (fs.existsSync(paramsPath)) params = JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
      await runBacktest(strategyName, data, params);
    } else {
      await runOptimization(strategyName, data, { generations, population });
      await runBacktest(strategyName, data);
    }
  } catch (error) {
    console.error(kleur.red(`Error: ${error}`));
    process.exit(1);
  }
}

main();
