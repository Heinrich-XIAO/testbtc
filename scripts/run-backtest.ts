import { Command } from 'commander';
import kleur from 'kleur';
import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import type { Strategy, BacktestConfig, BacktestResult } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

const DEFAULT_DATA_FILE = 'data/polymarket-data.bson';

function loadSavedParams(paramsFile: string): Record<string, number> | null {
  const paramsPath = path.join(process.cwd(), paramsFile);
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

const strategies: Record<string, { 
  name: string;
  getStrategy: (params: any) => Strategy;
  paramsFile: string;
}> = {
  'simple_ma': {
    name: 'Simple MA (01)',
    getStrategy: (params) => new (require('../src/strategies/strat_simple_ma_01').SimpleMAStrategy)(params),
    paramsFile: 'src/strategies/strat_simple_ma_01.params.json',
  },
  'bollinger': {
    name: 'Bollinger Bands (02)',
    getStrategy: (params) => new (require('../src/strategies/strat_bollinger_02').BollingerBandsStrategy)(params),
    paramsFile: 'src/strategies/strat_bollinger_02.params.json',
  },
  'rsi': {
    name: 'RSI Mean Reversion (03)',
    getStrategy: (params) => new (require('../src/strategies/strat_rsi_03').RSIMeanReversionStrategy)(params),
    paramsFile: 'src/strategies/strat_rsi_03.params.json',
  },
  'breakout': {
    name: 'Price Breakout (04)',
    getStrategy: (params) => new (require('../src/strategies/strat_atr_breakout_04').ATRBreakoutStrategy)(params),
    paramsFile: 'src/strategies/strat_atr_breakout_04.params.json',
  },
  'ma_vol': {
    name: 'MA + Volatility Stop (05)',
    getStrategy: (params) => new (require('../src/strategies/strat_ma_atr_05').MAStrategyWithATRStop)(params),
    paramsFile: 'src/strategies/strat_ma_atr_05.params.json',
  },
  'support': {
    name: 'Support/Resistance (06)',
    getStrategy: (params) => new (require('../src/strategies/strat_support_06').SupportResistanceStrategy)(params),
    paramsFile: 'src/strategies/strat_support_06.params.json',
  },
  'momentum': {
    name: 'Momentum (07)',
    getStrategy: (params) => new (require('../src/strategies/strat_momentum_07').ShortTermStrategy)(params),
    paramsFile: 'src/strategies/strat_momentum_07.params.json',
  },
  'range': {
    name: 'Range Trading (08)',
    getStrategy: (params) => new (require('../src/strategies/strat_range_08').RangeTradingStrategy)(params),
    paramsFile: 'src/strategies/strat_range_08.params.json',
  },
  'mean_revert': {
    name: 'Mean Reversion (09)',
    getStrategy: (params) => new (require('../src/strategies/strat_mean_revert_09').MeanReversionStrategy)(params),
    paramsFile: 'src/strategies/strat_mean_revert_09.params.json',
  },
  'dual_ma': {
    name: 'Dual MA + Trend (10)',
    getStrategy: (params) => new (require('../src/strategies/strat_dual_ma_10').DualMAStrategy)(params),
    paramsFile: 'src/strategies/strat_dual_ma_10.params.json',
  },
};

async function runBacktest(
  strategyInfo: typeof strategies['simple_ma'],
  data: any,
  options: any,
  savedParams: Record<string, number> | null
): Promise<{ result: BacktestResult; params: any }> {
  // Pass saved params directly to the strategy constructor - each strategy handles its own merging
  const strategy = strategyInfo.getStrategy(savedParams || {});

  const config: Partial<BacktestConfig> = {
    initialCapital: parseFloat(options.capital),
    feeRate: parseFloat(options.fee) / 100,
    slippage: 0,
  };

  const engine = new BacktestEngine(data, strategy, config);
  const result = engine.run();

  return { result, params: savedParams };
}

function buildParams(strategyInfo: any, options: any, savedParams: Record<string, number> | null): any {
  // Kept for backward compatibility but strategies now handle their own param merging
  return savedParams || {};
}

function printComparison(results: Array<{ strategy: string; result: BacktestResult }>) {
  const col = (s: string, w: number) => s.toString().padEnd(w).slice(0, w);
  
  console.log('\n' + kleur.bold(kleur.cyan('='.repeat(100))));
  console.log(kleur.bold(kleur.cyan('STRATEGY COMPARISON')));
  console.log(kleur.bold(kleur.cyan('='.repeat(100))));
  
  const header = col('Strategy', 20) + col('Final Capital', 14) + col('Return', 12) + col('Drawdown', 12) + col('Sharpe', 10) + col('Trades', 8) + col('Win Rate', 10);
  console.log(kleur.bold(header));
  console.log('-'.repeat(100));

  for (const { strategy, result } of results) {
    const winRate = result.totalTrades > 0 
      ? ((result.winningTrades / (result.winningTrades + result.losingTrades)) * 100).toFixed(1) + '%'
      : '-';
    
    const row = col(strategy, 20) +
      col('$' + result.finalCapital.toFixed(2), 14) +
      col('$' + result.totalReturn.toFixed(2) + ' (' + result.totalReturnPercent.toFixed(2) + '%)', 12) +
      col('-' + result.maxDrawdown.toFixed(2) + '%', 12) +
      col(result.sharpeRatio.toFixed(3), 10) +
      col(result.totalTrades.toString(), 8) +
      col(winRate, 10);
    
    const isBest = result.totalReturn === Math.max(...results.map(r => r.result.totalReturn));
    console.log(isBest ? kleur.green(row) : row);
  }

  console.log('-'.repeat(100));
  
  const best = results.reduce((a, b) => a.result.totalReturn > b.result.totalReturn ? a : b);
  console.log(kleur.green(`\n★ Best: ${best.strategy} with $${best.result.totalReturn.toFixed(2)} return`));
}

const program = new Command();

program
  .name('backtest')
  .description('Polymarket Backtest Runner')
  .option('-s, --strategy <name>', 'Strategy to use (all, simple_ma, bollinger, rsi, breakout, ma_vol, support, momentum, range, mean_revert, dual_ma)', 'all')
  .option('-d, --data <file>', 'Data file path', DEFAULT_DATA_FILE)
  .option('-c, --capital <number>', 'Initial capital in USD', '1000')
  .option('-f, --fee <percent>', 'Fee rate as percentage', '0')
  .option('--fast <number>', 'Fast MA period', '50')
  .option('--slow <number>', 'Slow MA period', '200')
  .option('--stop-loss <percent>', 'Stop loss as percentage', '2')
  .option('--risk-percent <percent>', 'Risk percent', '95')
  .option('-t, --trailing-stop', 'Enable trailing stop')
  .option('-v, --verbose', 'Show detailed trade history for each strategy')
  .action(async (options) => {
    console.log(kleur.cyan('Polymarket Backtest Runner'));
    console.log(kleur.cyan('=========================='));
    console.log(`Data file:       ${options.data}`);
    console.log(`Initial capital: $${options.capital}`);
    console.log(`Fee rate:        ${options.fee}%`);
    console.log('');

    try {
      console.log(kleur.yellow('Loading data...'));
      const data = loadStoredData(options.data);
      console.log(`Loaded ${data.markets.length} markets`);
      console.log(`Price history for ${data.priceHistory.size} tokens`);
      console.log('');

      const strategiesToRun = options.strategy === 'all' 
        ? Object.entries(strategies) 
        : [[options.strategy, strategies[options.strategy as keyof typeof strategies]]] as Array<[string, typeof strategies['ma']]>;

      if (options.strategy !== 'all' && !strategies[options.strategy as keyof typeof strategies]) {
        console.error(kleur.red(`Unknown strategy: ${options.strategy}`));
        console.log(`Available strategies: all, ${Object.keys(strategies).join(', ')}`);
        process.exit(1);
      }

      const results: Array<{ strategy: string; result: BacktestResult }> = [];

      for (const [key, strategyInfo] of strategiesToRun) {
        console.log(kleur.yellow(`Running ${strategyInfo.name}...`));
        const savedParams = loadSavedParams(strategyInfo.paramsFile);
        const { result } = await runBacktest(strategyInfo, data, options, savedParams);
        results.push({ strategy: strategyInfo.name, result });

        if (options.strategy !== 'all') {
          printComparison(results);
        }
      }

      if (options.strategy === 'all') {
        printComparison(results);
      }

    } catch (error) {
      console.error(kleur.red('Error running backtest:'), error);
      process.exit(1);
    }
  });

program.parse();
