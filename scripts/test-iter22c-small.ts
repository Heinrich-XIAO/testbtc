import { StratIter22CStrategy } from '../src/strategies/strat_iter22_c';
import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import * as path from 'path';

async function main() {
  const data = await loadStoredData(path.join(__dirname, '../data/test-data.bson'));
  console.log(`Loaded ${data.markets.length} markets, ${data.priceHistory.size} price histories`);
  
  const strategy = new StratIter22CStrategy({});
  const engine = new BacktestEngine(data, strategy);
  const result = engine.run();
  
  console.log(`\nBacktest results for iter22_c (small dataset):`);
  console.log(`  Final Capital: $${result.finalCapital.toFixed(2)}`);
  console.log(`  Total Return: $${result.totalReturn.toFixed(2)} (${result.totalReturnPercent.toFixed(2)}%)`);
  console.log(`  Total Trades: ${result.totalTrades}`);
  console.log(`  Win Rate: ${result.totalTrades > 0 ? ((result.winningTrades / result.totalTrades) * 100).toFixed(1) : 0}%`);
}

main().catch(console.error);
