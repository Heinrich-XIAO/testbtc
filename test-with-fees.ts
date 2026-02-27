import { loadStoredData, BacktestEngine } from './src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

const DATASET = 'data/stock-data.json';
const STRATEGY_FILE = 'src/strategies/strat_iter_stock_011.ts';

// Test StratIterStock013 with different fee rates
const FEE_RATES = [0, 0.01, 0.05, 0.1, 0.2];

async function main() {
  console.log('Testing StratIterStock013 with fees\n');
  console.log('Fee Rate | Return      | Trades  | Win Rate | Status');
  console.log('---------|-------------|---------|----------|--------');

  const data = loadStoredData(DATASET);
  const module = require(path.join(process.cwd(), STRATEGY_FILE));
  const StrategyClass = module.StratIterStock013Strategy;

  for (const feeRate of FEE_RATES) {
    const strategy = new StrategyClass({});
    const engine = new BacktestEngine(data, strategy, {
      initialCapital: 1000,
      feeRate: feeRate / 100,
      slippage: 0
    });

    const result = engine.run();
    const returnPct = ((result.totalReturn / 1000) - 1) * 100;
    const winRate = result.totalTrades > 0 ? (result.winningTrades / result.totalTrades) * 100 : 0;
    const status = result.totalReturn > 1000 ? '✅ PROFIT' : '❌ LOSS';

    console.log(
      `${feeRate.toString().padStart(6)}% | ` +
      `$${result.totalReturn.toFixed(2).padStart(10)} (${returnPct.toFixed(1)}%) | ` +
      `${result.totalTrades.toString().padStart(7)} | ` +
      `${winRate.toFixed(1)}% | ${status}`
    );
  }
}

main().catch(console.error);
