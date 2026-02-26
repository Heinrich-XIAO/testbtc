import { StratIter19BStrategy } from '../src/strategies/strat_iter19_b';
import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import * as path from 'path';

async function main() {
  const data = await loadStoredData(path.join(__dirname, '../data/test-data-15min-large.json'));
  console.log(`Loaded ${data.markets.length} markets, ${data.priceHistory.size} price histories`);
  
  const strategy = new StratIter19BStrategy({});
  const engine = new BacktestEngine(data, strategy);
  const result = engine.run();
  
  console.log(`\nBacktest results for iter19_b (large dataset):`);
  console.log(`  Final Capital: $${result.finalCapital.toFixed(2)}`);
  console.log(`  Total Return: $${result.totalReturn.toFixed(2)} (${result.totalReturnPercent.toFixed(2)}%)`);
  console.log(`  Total Trades: ${result.totalTrades}`);
  console.log(`  Win Rate: ${result.totalTrades > 0 ? ((result.winningTrades / result.totalTrades) * 100).toFixed(1) : 0}%`);
}

main().catch(console.error);
