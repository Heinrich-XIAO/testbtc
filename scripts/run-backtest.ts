import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import { SimpleMAStrategy } from '../src/strategies/example';
import type { BacktestConfig } from '../src/types';

const DEFAULT_DATA_FILE = 'data/polymarket-data.bson';

async function main() {
  const args = process.argv.slice(2);
  const dataIndex = args.indexOf('--data');
  const dataFile = dataIndex >= 0 ? args[dataIndex + 1] : DEFAULT_DATA_FILE;

  const capitalIndex = args.indexOf('--capital');
  const initialCapital = capitalIndex >= 0 ? parseFloat(args[capitalIndex + 1]) : 1000;

  const feeIndex = args.indexOf('--fee');
  const feeRate = feeIndex >= 0 ? parseFloat(args[feeIndex + 1]) / 100 : 0;

  const fastIndex = args.indexOf('--fast');
  const fastPeriod = fastIndex >= 0 ? parseInt(args[fastIndex + 1]) : 50;

  const slowIndex = args.indexOf('--slow');
  const slowPeriod = slowIndex >= 0 ? parseInt(args[slowIndex + 1]) : 200;

  const stopLossIndex = args.indexOf('--stop-loss');
  const stopLoss = stopLossIndex >= 0 ? parseFloat(args[stopLossIndex + 1]) / 100 : 0.02;

  console.log('Polymarket Backtest Runner');
  console.log('==========================');
  console.log(`Data file: ${dataFile}`);
  console.log(`Initial capital: $${initialCapital}`);
  console.log(`Fee rate: ${feeRate * 100}%`);
  console.log(`Fast MA: ${fastPeriod}`);
  console.log(`Slow MA: ${slowPeriod}`);
  console.log(`Stop loss: ${stopLoss * 100}%`);
  console.log('');

  try {
    console.log('Loading data...');
    const data = loadStoredData(dataFile);
    console.log(`Loaded ${data.markets.length} markets`);
    console.log(`Price history for ${data.priceHistory.size} tokens`);
    console.log('');

    const strategy = new SimpleMAStrategy({
      fast_period: fastPeriod,
      slow_period: slowPeriod,
      stop_loss: stopLoss,
      trailing_stop: false,
      risk_percent: 0.95,
    });

    const config: Partial<BacktestConfig> = {
      initialCapital,
      feeRate,
      slippage: 0,
    };

    console.log('Running backtest...\n');
    const engine = new BacktestEngine(data, strategy, config);
    const result = engine.run();

    console.log('\n' + '='.repeat(50));
    console.log('BACKTEST RESULTS');
    console.log('='.repeat(50));
    console.log(`Initial Capital:   $${initialCapital.toFixed(2)}`);
    console.log(`Final Capital:     $${result.finalCapital.toFixed(2)}`);
    console.log(`Total Return:      $${result.totalReturn.toFixed(2)} (${result.totalReturnPercent.toFixed(2)}%)`);
    console.log(`Max Drawdown:      ${result.maxDrawdown.toFixed(2)}%`);
    console.log(`Sharpe Ratio:      ${result.sharpeRatio.toFixed(3)}`);
    console.log(`Total Trades:      ${result.totalTrades}`);
    console.log(`Winning Trades:    ${result.winningTrades}`);
    console.log(`Losing Trades:     ${result.losingTrades}`);
    if (result.totalTrades > 0) {
      console.log(`Win Rate:          ${((result.winningTrades / (result.winningTrades + result.losingTrades)) * 100).toFixed(1)}%`);
    }
    console.log('='.repeat(50));

    if (result.tradeHistory.length > 0 && args.includes('--verbose')) {
      console.log('\nTRADE HISTORY:');
      console.log('-'.repeat(80));
      for (const trade of result.tradeHistory.slice(0, 20)) {
        const date = new Date(trade.timestamp * 1000).toISOString().split('T')[0];
        console.log(`${date} | ${trade.side.padEnd(4)} | ${trade.tokenId.slice(0, 12)}... | ${trade.size.toFixed(2).padStart(10)} @ ${trade.price.toFixed(4).padStart(8)} | $${trade.totalCost.toFixed(2).padStart(10)}`);
      }
      if (result.tradeHistory.length > 20) {
        console.log(`... and ${result.tradeHistory.length - 20} more trades`);
      }
    }

  } catch (error) {
    console.error('Error running backtest:', error);
    process.exit(1);
  }
}

main();
