import { Command } from 'commander';
import kleur from 'kleur';
import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import type { Strategy, StrategyParams } from '../src/types';
import type { BacktestConfig } from '../src/types';
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

const program = new Command();

program
  .name('backtest')
  .description('Polymarket Backtest Runner')
  .option('-s, --strategy <name>', 'Strategy to use (ma, bollinger)', 'ma')
  .option('-d, --data <file>', 'Data file path', DEFAULT_DATA_FILE)
  .option('-c, --capital <number>', 'Initial capital in USD', '1000')
  .option('-f, --fee <percent>', 'Fee rate as percentage', '0')
  .option('--fast <number>', 'Fast MA period (or from optimized params)', '50')
  .option('--slow <number>', 'Slow MA period (or from optimized params)', '200')
  .option('--stop-loss <percent>', 'Stop loss as percentage (or from optimized params)', '2')
  .option('--risk-percent <percent>', 'Risk percent (or from optimized params)', '95')
  .option('-t, --trailing-stop', 'Enable trailing stop')
  .option('-v, --verbose', 'Show detailed trade history')
  .action(async (options) => {
    let StrategyClass: new (params: any) => Strategy;
    let paramsFile: string;

    if (options.strategy === 'bollinger') {
      const mod = await import('../src/strategies/bollinger_bands');
      StrategyClass = mod.BollingerBandsStrategy;
      paramsFile = 'src/strategies/bollinger_bands.params.json';
    } else {
      const mod = await import('../src/strategies/example');
      StrategyClass = mod.SimpleMAStrategy;
      paramsFile = 'src/strategies/example.params.json';
    }

    const savedParams = loadSavedParams(paramsFile);

    const initialCapital = parseFloat(options.capital);
    const feeRate = parseFloat(options.fee) / 100;
    const fastPeriod = options.fast !== '50' ? parseInt(options.fast) : (savedParams?.fast_period ?? 50);
    const slowPeriod = options.slow !== '200' ? parseInt(options.slow) : (savedParams?.slow_period ?? 200);
    const stopLoss = options.stopLoss !== '2' ? parseFloat(options.stopLoss) / 100 : (savedParams?.stop_loss ?? 0.02);
    const riskPercent = options.riskPercent !== '95' ? parseFloat(options.riskPercent) / 100 : (savedParams?.risk_percent ?? 0.95);
    const trailingStop = options.trailingStop;
    const verbose = options.verbose;

    console.log(kleur.cyan('Polymarket Backtest Runner'));
    console.log(kleur.cyan('=========================='));
    console.log(`Strategy:        ${options.strategy}`);
    console.log(`Data file:       ${options.data}`);
    console.log(`Initial capital: $${initialCapital}`);
    console.log(`Fee rate:        ${feeRate * 100}%`);
    console.log(`Fast MA:         ${fastPeriod}`);
    console.log(`Slow MA:         ${slowPeriod}`);
    console.log(`Stop loss:       ${stopLoss * 100}%`);
    console.log(`Risk percent:    ${riskPercent * 100}%`);
    console.log(`Trailing stop:   ${trailingStop}`);
    console.log('');

    try {
      console.log(kleur.yellow('Loading data...'));
      const data = loadStoredData(options.data);
      console.log(`Loaded ${data.markets.length} markets`);
      console.log(`Price history for ${data.priceHistory.size} tokens`);
      console.log('');

      const strategy = new StrategyClass({
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

      console.log(kleur.yellow('Running backtest...\n'));
      const engine = new BacktestEngine(data, strategy, config);
      const result = engine.run();

      console.log('\n' + kleur.bold(kleur.cyan('='.repeat(50))));
      console.log(kleur.bold(kleur.cyan('BACKTEST RESULTS')));
      console.log(kleur.bold(kleur.cyan('='.repeat(50))));
      console.log(`Initial Capital:   $${initialCapital.toFixed(2)}`);
      console.log(`Final Capital:     $${result.finalCapital.toFixed(2)}`);
      console.log(`Total Return:      $${result.totalReturn.toFixed(2)} (${result.totalReturnPercent.toFixed(2)}%)`);
      console.log(`Max Drawdown:      ${result.maxDrawdown.toFixed(2)}%`);
      console.log(`Sharpe Ratio:      ${result.sharpeRatio.toFixed(3)}`);
      console.log(`Total Trades:      ${result.totalTrades}`);
      console.log(`Winning Trades:    ${result.winningTrades}`);
      console.log(`Losing Trades:     ${result.losingTrades}`);
      if (result.totalTrades > 0) {
        const winRate = (result.winningTrades / (result.winningTrades + result.losingTrades)) * 100;
        console.log(`Win Rate:          ${winRate.toFixed(1)}%`);
      }
      console.log('='.repeat(50));

      if (verbose && result.tradeHistory.length > 0) {
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
      console.error(kleur.red('Error running backtest:'), error);
      process.exit(1);
    }
  });

program.parse();
