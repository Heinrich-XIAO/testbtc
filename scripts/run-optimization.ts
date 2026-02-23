import { Command } from 'commander';
import kleur from 'kleur';
import { loadStoredData } from '../src/backtest/engine';
import { SimpleMAStrategy } from '../src/strategies/strat_simple_ma_01';
import { DifferentialEvolutionOptimizer } from '../src/optimization';
import type { ParamConfig, OptimizationResult } from '../src/optimization/types';
import type { StoredData } from '../src/types';
import { BacktestEngine } from '../src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

const strategies: Record<string, { class: any; params: Record<string, ParamConfig>; outputFile: string }> = {
  simple_ma: {
    class: SimpleMAStrategy,
    params: {
      fast_period: { min: 5, max: 30, stepSize: 5 },
      slow_period: { min: 20, max: 100, stepSize: 10 },
      stop_loss: { min: 0.02, max: 0.1, stepSize: 0.02 },
      trailing_stop: { min: 0, max: 0.05, stepSize: 0.01 },
      risk_percent: { min: 0.1, max: 0.5, stepSize: 0.1 },
    },
    outputFile: 'strat_simple_ma_01.params.json',
  },
};

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
  options: { generations: number; population: number; fidelity: number }
): Promise<OptimizationResult> {
  const strategyConfig = strategies[strategyName];
  if (!strategyConfig) throw new Error(`Unknown strategy: ${strategyName}`);

  console.log(kleur.cyan(`\nOptimizing ${strategyName}...`));

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
    .argument('[strategy]', 'Strategy name', 'simple_ma')
    .option('-d, --dataset <path>', 'Path to dataset', 'data/test-data.bson')
    .option('-g, --generations <number>', 'Number of generations', '20')
    .option('--backtest-only', 'Run backtest only', false)
    .parse(process.argv);

  const options = program.opts();
  const strategyName = program.args[0] || 'simple_ma';

  try {
    const data = await loadDataset(options.dataset);

    if (options.backtestOnly) {
      const paramsPath = path.join(__dirname, '../src/strategies', strategies[strategyName].outputFile);
      let params = {};
      if (fs.existsSync(paramsPath)) params = JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
      await runBacktest(strategyName, data, params);
    } else {
      await runOptimization(strategyName, data, { generations: parseInt(options.generations), population: 15, fidelity: 1 });
      await runBacktest(strategyName, data);
    }
  } catch (error) {
    console.error(kleur.red(`Error: ${error}`));
    process.exit(1);
  }
}

main();
