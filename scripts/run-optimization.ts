import { Command } from 'commander';
import kleur from 'kleur';
import { loadStoredData } from '../src/backtest/engine';
import { SimpleMAStrategy, type SimpleMAStrategyParams } from '../src/strategies/example';
import { BollingerBandsStrategy, type BollingerBandsStrategyParams } from '../src/strategies/bollinger_bands';
import { DifferentialEvolutionOptimizer } from '../src/optimization';
import type { ParamConfig, OptimizationResult } from '../src/optimization/types';
import type { StoredData, PricePoint } from '../src/types';
import { BacktestEngine } from '../src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

const strategies: Record<string, { class: any; params: Record<string, ParamConfig>; outputFile: string }> = {
  simple_ma: {
    class: SimpleMAStrategy,
    params: {
      fast_period: { min: 5, max: 100, stepSize: 10 },
      slow_period: { min: 20, max: 300, stepSize: 20 },
      stop_loss: { min: 0.01, max: 0.2, stepSize: 0.02 },
      trailing_stop: { min: 0, max: 1, stepSize: 1 },
      risk_percent: { min: 0.1, max: 1.0, stepSize: 0.2 },
    },
    outputFile: 'example.params.json',
  },
  bollinger_bands: {
    class: BollingerBandsStrategy,
    params: {
      period: { min: 10, max: 50, stepSize: 5 },
      std_dev_multiplier: { min: 1.5, max: 3.0, stepSize: 0.5 },
      stop_loss: { min: 0.01, max: 0.1, stepSize: 0.02 },
      trailing_stop: { min: 0, max: 1, stepSize: 1 },
      risk_percent: { min: 0.05, max: 0.3, stepSize: 0.05 },
      mean_reversion: { min: 0, max: 1, stepSize: 1 },
    },
    outputFile: 'bollinger_bands.params.json',
  },
};

function splitData(data: StoredData, trainRatio: number = 0.7): { train: StoredData; test: StoredData } {
  const allTimestamps: number[] = [];
  for (const history of data.priceHistory.values()) {
    for (const point of history) {
      allTimestamps.push(point.t);
    }
  }
  
  allTimestamps.sort((a, b) => a - b);
  const splitIndex = Math.floor(allTimestamps.length * trainRatio);
  const splitTime = allTimestamps[splitIndex];
  
  const trainPriceHistory = new Map<string, PricePoint[]>();
  const testPriceHistory = new Map<string, PricePoint[]>();
  
  for (const [tokenId, history] of data.priceHistory) {
    const trainPoints: PricePoint[] = [];
    const testPoints: PricePoint[] = [];
    
    for (const point of history) {
      if (point.t <= splitTime) {
        trainPoints.push(point);
      } else {
        testPoints.push(point);
      }
    }
    
    if (trainPoints.length > 0) {
      trainPriceHistory.set(tokenId, trainPoints);
    }
    if (testPoints.length > 0) {
      testPriceHistory.set(tokenId, testPoints);
    }
  }
  
  return {
    train: {
      markets: data.markets,
      priceHistory: trainPriceHistory,
      collectionMetadata: data.collectionMetadata,
    },
    test: {
      markets: data.markets,
      priceHistory: testPriceHistory,
      collectionMetadata: data.collectionMetadata,
    },
  };
}

function testParams(data: StoredData, strategyClass: any, params: Record<string, number>): { return: number; sharpe: number; trades: number } {
  const strategy = new strategyClass(params);
  const engine = new BacktestEngine(data, strategy, { feeRate: 0.002 });
  
  const originalLog = console.log;
  console.log = () => {};
  
  try {
    const result = engine.run();
    return { return: result.totalReturn, sharpe: result.sharpeRatio, trades: result.totalTrades };
  } finally {
    console.log = originalLog;
  }
}

const program = new Command();

program
  .name('optimize')
  .description('Differential Evolution Optimization for Trading Strategy')
  .option('-l, --list-strategies', 'List available strategies')
  .option('-s, --strategy <name>', 'Strategy to optimize', 'simple_ma')
  .option('-i, --max-iterations <number>', 'Maximum generations', '100')
  .option('-r, --random-samples <number>', 'Initial random samples', '50')
  .option('-d, --data <file>', 'Data file path', 'data/polymarket-data.bson')
  .option('-m, --min-test-return <number>', 'Minimum test return to accept', '10')
  .option('-a, --attempts <number>', 'Number of optimization attempts', '5')
  .action(async (options) => {
    if (options.listStrategies) {
      console.log(kleur.cyan('Available strategies:'));
      for (const [name, config] of Object.entries(strategies)) {
        console.log('  ' + kleur.green(name) + ' -> ' + config.outputFile);
      }
      process.exit(0);
    }
    
    if (options.plot) {
      const historyPath = path.join(process.cwd(), 'data', 'optimization-history.json');
      if (!fs.existsSync(historyPath)) {
        console.error(kleur.red('No optimization history found. Run optimize first.'));
        process.exit(1);
      }
      const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      
      console.log(kleur.cyan('Optimization Progress\n'));
      console.log('Generation | Sharpe Ratio');
      console.log('-'.repeat(30));
      for (const entry of historyData.history) {
        console.log(String(entry.iteration).padStart(10) + ' | ' + entry.sharpeRatio.toFixed(4));
      }
      console.log('-'.repeat(30));
      console.log('\nBest params:');
      for (const [k, v] of Object.entries(historyData.bestParams)) {
        if (k !== 'metadata') console.log('  ' + k + ': ' + v);
      }
      console.log('\nPerformance:');
      console.log('  Test Return: ' + historyData.finalMetrics.testReturn.toFixed(2) + ' (' + (historyData.finalMetrics.testReturn / 10).toFixed(1) + '%)');
      console.log('  Test Sharpe: ' + historyData.finalMetrics.testSharpe.toFixed(4));
      console.log('  Test Trades: ' + historyData.finalMetrics.testTrades);
      process.exit(0);
    }
    
    const strategyName = options.strategy;
    const strategyConfig = strategies[strategyName];
    
    if (!strategyConfig) {
      console.error(kleur.red('Unknown strategy: ' + strategyName));
      console.log(kleur.yellow('Available strategies:') + ' ' + Object.keys(strategies).join(', '));
      process.exit(1);
    }
    
    const StrategyClass = strategyConfig.class;
    const paramConfigs = strategyConfig.params;
    const outputFile = strategyConfig.outputFile;
    
    const maxIterations = parseInt(options.maxIterations);
    const randomSamples = parseInt(options.randomSamples);
    const dataFile = options.data;
    const minTestReturn = parseFloat(options.minTestReturn);
    const attempts = parseInt(options.attempts);

    console.log(kleur.cyan('Strategy:') + ' ' + strategyName);
    console.log(kleur.cyan('Loading data from:') + ' ' + dataFile);
    const fullData = loadStoredData(dataFile);
    console.log('Loaded ' + fullData.markets.length + ' markets');
    
    console.log(kleur.yellow('\nSplitting data: 70% train, 30% test...'));
    const { train: trainSplit, test: testSplit } = splitData(fullData, 0.7);
    
    const maxTokens = 500;
    const trainTokens = Array.from(trainSplit.priceHistory.keys()).slice(0, maxTokens);
    const trainSampled = new Map(trainTokens.map(k => [k, trainSplit.priceHistory.get(k)!]));
    const testTokens = Array.from(testSplit.priceHistory.keys()).slice(0, maxTokens);
    const testSampled = new Map(testTokens.map(k => [k, testSplit.priceHistory.get(k)!]));
    
    const train: StoredData = {
      ...fullData,
      priceHistory: trainSampled,
    };
    const test: StoredData = {
      ...fullData,
      priceHistory: testSampled,
    };
    
    let totalTrainPoints = 0;
    let totalTestPoints = 0;
    for (const history of train.priceHistory.values()) totalTrainPoints += history.length;
    for (const history of test.priceHistory.values()) totalTestPoints += history.length;
    
    console.log('Train: ' + totalTrainPoints + ' price points, Test: ' + totalTestPoints + ' price points (' + maxTokens + ' tokens)');
    console.log('Max generations: ' + maxIterations + ', Attempts: ' + attempts);

    console.log('\n' + kleur.bold(kleur.magenta('='.repeat(60))));
    console.log(kleur.bold(kleur.magenta('Differential Evolution Optimization')));
    console.log(kleur.bold(kleur.magenta('='.repeat(60))));

    let bestResult: OptimizationResult | null = null;
    let bestTestReturn = -Infinity;
    let bestParams: Record<string, number> | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      console.log(kleur.yellow('\nAttempt ' + attempt + '/' + attempts + '...'));
      console.log(kleur.cyan('  Random search (' + randomSamples + ' samples)...'));
      
      const optimizer = new DifferentialEvolutionOptimizer(train, StrategyClass, paramConfigs, {
        maxIterations,
        convergenceThreshold: 1e-6,
        learningRate: 1.0,
        randomSamples,
      });

      const result = await optimizer.optimize(attempt === 1 ? null : bestParams);
      console.log(kleur.cyan('  DE running...'));
      
      const testMetrics = testParams(test, StrategyClass, result.finalParams);
      
      console.log('  Train Score: ' + result.bestSharpe.toFixed(4));
      console.log('  Test Return: $' + testMetrics.return.toFixed(2));
      console.log('  Test Sharpe: ' + testMetrics.sharpe.toFixed(4));
      console.log('  Trades: ' + testMetrics.trades);
      
      if (testMetrics.return > bestTestReturn) {
        bestTestReturn = testMetrics.return;
        bestResult = result;
        bestParams = result.finalParams;
        console.log(kleur.green('  ★ NEW BEST'));
        
        if (testMetrics.return >= minTestReturn) {
          console.log(kleur.green('\n✓ Reached target test return of $' + minTestReturn));
          break;
        }
      }
    }

    if (!bestResult || !bestParams) {
      console.error(kleur.red('\n✗ Failed to find valid parameters'));
      process.exit(1);
    }

    const finalTestMetrics = testParams(test, StrategyClass, bestParams);
    const fullMetrics = testParams(fullData, StrategyClass, bestParams);

    console.log('\n' + kleur.bold(kleur.cyan('='.repeat(60))));
    console.log(kleur.bold(kleur.cyan('FINAL RESULTS')));
    console.log(kleur.bold(kleur.cyan('='.repeat(60))));
    
    console.log('\nParameters:');
    for (const [key, value] of Object.entries(bestParams)) {
      const config = paramConfigs[key];
      if (config.stepSize === 1 && config.min === 0 && config.max === 1) {
        console.log('  ' + key + ': ' + (value === 1 ? 'true' : 'false'));
      } else if (key === 'stop_loss' || key === 'risk_percent') {
        console.log('  ' + key + ': ' + value.toFixed(4) + ' (' + (value * 100).toFixed(2) + '%)');
      } else {
        console.log('  ' + key + ': ' + value);
      }
    }
    
    console.log('\nPerformance:');
    console.log('  Test Return: $' + finalTestMetrics.return.toFixed(2));
    console.log('  Test Sharpe: ' + finalTestMetrics.sharpe.toFixed(4));
    console.log('  Test Trades: ' + finalTestMetrics.trades);
    console.log('  Full Return: $' + fullMetrics.return.toFixed(2));
    console.log('  Full Sharpe: ' + fullMetrics.sharpe.toFixed(4));
    console.log('  Iterations: ' + bestResult.iterations);
    console.log('  Converged: ' + (bestResult.converged ? 'Yes' : 'No'));

    console.log(kleur.cyan('\nOptimization Progress\n'));
    console.log('Generation | Sharpe Ratio');
    console.log('-'.repeat(30));
    for (const entry of bestResult.history) {
      console.log(String(entry.iteration).padStart(10) + ' | ' + entry.sharpeRatio.toFixed(4));
    }
    console.log('-'.repeat(30));

    const output = {
      ...bestParams,
      metadata: {
        best_test_return: finalTestMetrics.return,
        optimized_at: new Date().toISOString(),
      },
    };
    
    const outputPath = path.join(process.cwd(), 'src', 'strategies', outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(kleur.green('\n✓ Parameters saved to ' + outputFile));

    const historyPath = path.join(process.cwd(), 'data', 'optimization-history.json');
    const historyData = {
      strategy: strategyName,
      bestParams,
      history: bestResult.history,
      finalMetrics: {
        testReturn: finalTestMetrics.return,
        testSharpe: finalTestMetrics.sharpe,
        testTrades: finalTestMetrics.trades,
        fullReturn: fullMetrics.return,
        fullSharpe: fullMetrics.sharpe,
      },
    };
    fs.writeFileSync(historyPath, JSON.stringify(historyData, null, 2));
    console.log(kleur.green('✓ History saved to optimization-history.json'));
  });

program.parse();
