import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import { SimpleMAStrategy } from '../src/strategies/example';
import type { BacktestConfig } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_DATA_FILE = 'data/polymarket-data.bson';

function loadSavedParams(): any | null {
  const paramsPath = path.join(process.cwd(), 'src', 'strategies', 'example.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function showHelp() {
  console.log(`
Usage: bun run scripts/run-backtest.ts [options]

Options:
  --data <file>         Data file path (default: data/polymarket-data.bson)
  --capital <n>         Initial capital in USD (default: 1000)
  --fee <percent>       Fee rate as percentage (default: 0)
  --fast <n>            Fast MA period (default: 50, or from optimized params)
  --slow <n>            Slow MA period (default: 200, or from optimized params)
  --stop-loss <percent> Stop loss as percentage (default: 2, or from optimized params)
  --risk-percent <n>    Risk percent as percentage (default: 95, or from optimized params)
  --trailing-stop       Enable trailing stop (default: false, or from optimized params)
  --verbose             Show detailed trade history
  --help, -h            Show this help
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const dataIndex = args.indexOf('--data');
  const dataFile = dataIndex >= 0 ? args[dataIndex + 1] : DEFAULT_DATA_FILE;

  const capitalIndex = args.indexOf('--capital');
  const initialCapital = capitalIndex >= 0 ? parseFloat(args[capitalIndex + 1]) : 1000;

  const feeIndex = args.indexOf('--fee');
  const feeRate = feeIndex >= 0 ? parseFloat(args[feeIndex + 1]) / 100 : 0;

  const savedParams = loadSavedParams();

  const fastIndex = args.indexOf('--fast');
  const fastPeriod = fastIndex >= 0 ? parseInt(args[fastIndex + 1]) : (savedParams?.fast_period ?? 50);

  const slowIndex = args.indexOf('--slow');
  const slowPeriod = slowIndex >= 0 ? parseInt(args[slowIndex + 1]) : (savedParams?.slow_period ?? 200);

  const stopLossIndex = args.indexOf('--stop-loss');
  const stopLoss = stopLossIndex >= 0 ? parseFloat(args[stopLossIndex + 1]) / 100 : (savedParams?.stop_loss ?? 0.02);

  const riskPercentIndex = args.indexOf('--risk-percent');
  const riskPercent = riskPercentIndex >= 0 ? parseFloat(args[riskPercentIndex + 1]) / 100 : (savedParams?.risk_percent ?? 0.95);

  const trailingStopIndex = args.indexOf('--trailing-stop');
  const trailingStop = trailingStopIndex >= 0 ? (args[trailingStopIndex + 1] === 'true') : (savedParams?.trailing_stop === 1);

  console.log('Polymarket Backtest Runner');
  console.log('==========================');
  console.log(`Data file: ${dataFile}`);
  console.log(`Initial capital: $${initialCapital}`);
  console.log(`Fee rate: ${feeRate * 100}%`);
  console.log(`Fast MA: ${fastPeriod}`);
  console.log(`Slow MA: ${slowPeriod}`);
  console.log(`Stop loss: ${stopLoss * 100}%`);
  console.log(`Risk percent: ${riskPercent * 100}%`);
  console.log(`Trailing stop: ${trailingStop}`);
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
      trailing_stop: trailingStop,
      risk_percent: riskPercent,
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
