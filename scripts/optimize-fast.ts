import { Command } from 'commander';
import kleur from 'kleur';
import { loadStoredData } from '../src/backtest/engine';
import type { StoredData } from '../src/types';
import { BacktestEngine } from '../src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

// Base strategies with their class mappings
const BASE_STRATEGIES: Record<string, { file: string; className: string; params: Record<string, number[]> }> = {
  'simple_ma': {
    file: 'strat_simple_ma_01',
    className: 'SimpleMAStrategy',
    params: {
      fast_period: [5, 10, 20],
      slow_period: [30, 50],
      stop_loss: [0.05, 0.10],
      trailing_stop: [0.03, 0.08],
      risk_percent: [0.25, 0.40],
    }
  },
  'stoch_baseline_01': {
    file: 'strat_stoch_baseline_01',
    className: 'StochBaseline01Strategy',
    params: {
      stoch_k_period: [14],
      stoch_d_period: [3],
      stoch_oversold: [16],
      stoch_overbought: [84],
      stop_loss: [0.05, 0.10],
      profit_target: [0.15],
      max_hold_bars: [30],
      risk_percent: [0.30],
    }
  },
  'stoch_baseline_02': {
    file: 'strat_stoch_baseline_02',
    className: 'StochBaseline02Strategy',
    params: {
      stoch_k_period: [10, 14],
      stoch_d_period: [3, 5],
      stoch_oversold: [16, 20],
      stoch_overbought: [76, 84],
      stop_loss: [0.05, 0.10],
      profit_target: [0.10, 0.20],
      max_hold_bars: [20, 40],
      risk_percent: [0.25, 0.40],
    }
  },
  'sr_stoch_01': {
    file: 'strat_sr_stoch_01',
    className: 'SrStoch01Strategy',
    params: {
      sr_lookback: [40],
      bounce_threshold: [0.01],
      stoch_oversold: [18],
      stop_loss: [0.08],
      profit_target: [0.15],
      max_hold_bars: [30],
      risk_percent: [0.30],
    }
  },
};

function generateCombinations(params: Record<string, number[]>): Record<string, number>[] {
  const keys = Object.keys(params);
  const values = keys.map(k => params[k]);
  
  function cartesian(arr: number[][]): number[][] {
    return arr.reduce((a, b) => a.flatMap(d => b.map(e => [...d, e])), [[]] as number[][]);
  }
  
  const combos = cartesian(values);
  return combos.map(combo => {
    const result: Record<string, number> = {};
    keys.forEach((key, i) => result[key] = combo[i]);
    return result;
  });
}

async function loadDataset(datasetPath: string, sampleSize?: number): Promise<StoredData> {
  const absolutePath = path.resolve(datasetPath);
  console.log(kleur.gray(`Loading dataset from: ${absolutePath}`));
  const data = await loadStoredData(absolutePath);
  
  // Sample markets if specified
  if (sampleSize && data.markets.length > sampleSize) {
    const shuffled = [...data.markets].sort(() => 0.5 - Math.random());
    const sampledMarkets = shuffled.slice(0, sampleSize);
    const sampledTokenIds = new Set(sampledMarkets.map(m => m.tokens[0]?.token_id).filter(Boolean));
    
    // Filter priceHistory to only include sampled markets
    const newPriceHistory = new Map();
    for (const [tokenId, history] of data.priceHistory.entries()) {
      if (sampledTokenIds.has(tokenId)) {
        newPriceHistory.set(tokenId, history);
      }
    }
    
    data.markets = sampledMarkets;
    data.priceHistory = newPriceHistory;
    console.log(kleur.gray(`Sampled ${sampleSize} markets for fast optimization\n`));
  } else {
    console.log(kleur.gray(`Loaded ${data.markets.length} markets\n`));
  }
  
  return data;
}

async function optimizeStrategy(
  strategyKey: string,
  data: StoredData,
  config: { file: string; className: string; params: Record<string, number[]> }
): Promise<{ bestParams: Record<string, number>; bestReturn: number; totalTests: number }> {
  const strategiesDir = path.join(__dirname, '../src/strategies');
  const filePath = path.join(strategiesDir, `${config.file}.ts`);
  
  const strategyModule = require(filePath);
  const StrategyClass = strategyModule[config.className];
  
  if (!StrategyClass) {
    throw new Error(`Strategy class ${config.className} not found`);
  }

  const combinations = generateCombinations(config.params);
  console.log(kleur.cyan(`Testing ${strategyKey}: ${combinations.length} combinations`));

  let bestReturn = -Infinity;
  let bestParams: Record<string, number> = {};
  let tested = 0;

  for (const params of combinations) {
    try {
      const strategy = new StrategyClass(params);
      const engine = new BacktestEngine(data, strategy);
      const result = engine.run();
      
      if (result.totalReturn > bestReturn) {
        bestReturn = result.totalReturn;
        bestParams = params;
      }
      
      tested++;
      if (tested % 50 === 0) {
        process.stdout.write(`  ${tested}/${combinations.length} tested, best: $${bestReturn.toFixed(2)}\r`);
      }
    } catch (e) {
      // Skip failed combinations
    }
  }

  console.log(`  ${tested}/${combinations.length} tested, best: $${bestReturn.toFixed(2)}  `);
  
  // Save best params
  const outputPath = path.join(strategiesDir, `${config.file}.params.json`);
  fs.writeFileSync(outputPath, JSON.stringify(bestParams, null, 2));
  
  return { bestParams, bestReturn, totalTests: tested };
}

async function runBacktest(
  strategyKey: string,
  data: StoredData,
  config: { file: string; className: string; params: Record<string, number[]> }
): Promise<void> {
  const strategiesDir = path.join(__dirname, '../src/strategies');
  const paramsPath = path.join(strategiesDir, `${config.file}.params.json`);
  
  let params = {};
  if (fs.existsSync(paramsPath)) {
    params = JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  }
  
  const filePath = path.join(strategiesDir, `${config.file}.ts`);
  const strategyModule = require(filePath);
  const StrategyClass = strategyModule[config.className];
  
  const strategy = new StrategyClass(params);
  const engine = new BacktestEngine(data, strategy);
  const result = engine.run();

  console.log(kleur.cyan(`\n${strategyKey} results:`));
  console.log(kleur.white(`  Final Capital: $${result.finalCapital.toFixed(2)}`));
  console.log(kleur.white(`  Total Return: $${result.totalReturn.toFixed(2)} (${result.totalReturnPercent.toFixed(2)}%)`));
  console.log(kleur.white(`  Total Trades: ${result.totalTrades}`));
  console.log(kleur.white(`  Win Rate: ${result.totalTrades > 0 ? ((result.winningTrades / result.totalTrades) * 100).toFixed(1) : 0}%`));
}

async function main() {
  const program = new Command();
  program
    .name('optimize-fast')
    .argument('<strategy>', 'Strategy name (simple_ma, stoch_baseline_01, stoch_baseline_02, sr_stoch_01)')
    .option('-d, --dataset <path>', 'Path to dataset', 'data/stock-data.json')
    .option('--backtest-only', 'Run backtest only', false)
    .parse(process.argv);

  const options = program.opts();
  const strategyKey = program.args[0];

  const config = BASE_STRATEGIES[strategyKey];
  if (!config) {
    console.error(kleur.red(`Unknown strategy: ${strategyKey}`));
    console.log('Available:', Object.keys(BASE_STRATEGIES).join(', '));
    process.exit(1);
  }

  console.log(kleur.cyan('Fast Grid Search Optimization'));
  console.log(kleur.cyan('=============================='))
  console.log(`Strategy: ${strategyKey}`);
  console.log(`Dataset: ${options.dataset}\n`);

  try {
    // Use sampling for optimization, full dataset for backtest
    const sampleSize = options.backtestOnly ? undefined : 100;
    const data = await loadDataset(options.dataset, sampleSize);

    if (options.backtestOnly) {
      await runBacktest(strategyKey, data, config);
    } else {
      const startTime = Date.now();
      const result = await optimizeStrategy(strategyKey, data, config);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(kleur.green(`\nOptimization complete in ${duration}s`));
      console.log(kleur.gray(`Best params: ${JSON.stringify(result.bestParams, null, 2)}`));
      
      // Run backtest on full dataset with best params
      console.log(kleur.yellow('\nRunning backtest on full dataset...'));
      const fullData = await loadDataset(options.dataset);
      await runBacktest(strategyKey, fullData, config);
    }
  } catch (error) {
    console.error(kleur.red(`Error: ${error}`));
    process.exit(1);
  }
}

main();
