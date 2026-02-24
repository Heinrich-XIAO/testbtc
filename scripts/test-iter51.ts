import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import { StratIter51AStrategy } from '../src/strategies/strat_iter51_a';
import { StratIter51BStrategy } from '../src/strategies/strat_iter51_b';
import { StratIter51CStrategy } from '../src/strategies/strat_iter51_c';

async function runTest(strategyClass: any, name: string, dataFile: string) {
  const data = await loadStoredData(dataFile);
  const strategy = new strategyClass();
  const engine = new BacktestEngine(data, strategy);
  const result = engine.run();
  
  console.log(`\n${name} on ${dataFile}:`);
  console.log(`  Final Capital: $${result.finalCapital.toFixed(2)}`);
  console.log(`  Total Return: ${(result.totalReturn * 100).toFixed(2)}%`);
  console.log(`  Total Return Percent: ${(result.totalReturnPercent * 100).toFixed(2)}%`);
  console.log(`  Trades: ${result.totalTrades}`);
  console.log(`  Winning: ${result.winningTrades}, Losing: ${result.losingTrades}`);
  console.log(`  Win Rate: ${result.totalTrades > 0 ? (result.winningTrades / result.totalTrades * 100).toFixed(1) : 0}%`);
  console.log(`  Max Drawdown: ${(result.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`  Sharpe: ${result.sharpeRatio.toFixed(3)}`);
  
  return result;
}

async function main() {
  console.log('Testing Iteration 51 Strategies...\n');
  
  const strategies = [
    { class: StratIter51AStrategy, name: 'iter51_a (Genetic Fitness Proxy)' },
    { class: StratIter51BStrategy, name: 'iter51_b (Entropy Chaos Filter)' },
    { class: StratIter51CStrategy, name: 'iter51_c (Fractal Cycle Phase)' },
  ];
  
  const datasets = [
    { file: 'data/test-data.bson', name: 'Small' },
    { file: 'data/test-data-15min-large.bson', name: 'Large' },
  ];
  
  for (const strat of strategies) {
    for (const ds of datasets) {
      await runTest(strat.class, strat.name, ds.file);
    }
  }
}

main().catch(console.error);
