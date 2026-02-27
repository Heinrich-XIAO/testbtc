import { Command } from 'commander';
import kleur from 'kleur';
import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import type { BacktestConfig, BacktestResult } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

const DEFAULT_DATA_FILE = 'data/stock-data.json';

// Top strategies from ATTEMPTED.md / SUMMARY.md
const TOP_STRATEGIES = [
  'strat_sr_no_trend_tight_stoch_309',
  'strat_sr_tight_momentum_306',
  'strat_sr_no_trend_filter_302',
  'strat_sr_no_trend_higher_profit_312',
  'strat_sr_no_momentum_filter_293',
  'strat_sr_no_trend_lower_risk_311',
  'strat_stoch_baseline_01',
  'strat_stoch_baseline_02',
  'strat_stoch_baseline_03',
  'strat_simple_ma_01',
  'strat_sr_stoch_01',
  'strat_sr_stoch_02',
  'strat_sr_stoch_03',
];

function loadParams(paramsFile: string): Record<string, number> {
  const fullPath = path.join(process.cwd(), paramsFile);
  if (!fs.existsSync(fullPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  } catch {
    return {};
  }
}

function formatCurrency(value: number): string {
  return '$' + value.toFixed(2);
}

const program = new Command();

program
  .name('backtest-top')
  .description('Backtest top proven strategies')
  .option('-d, --data <file>', 'Data file path', DEFAULT_DATA_FILE)
  .option('-c, --capital <number>', 'Initial capital in USD', '1000')
  .option('-f, --fee <percent>', 'Fee rate as percentage', '0')
  .action(async (options) => {
    console.log(kleur.cyan('Stock Backtest Runner - Top Strategies'));
    console.log(kleur.cyan('======================================'));
    console.log(`Data file:       ${options.data}`);
    console.log(`Initial capital: $${options.capital}`);
    console.log(`Fee rate:        ${options.fee}%`);
    console.log('');

    const strategiesDir = path.join(__dirname, '../src/strategies');
    
    console.log(kleur.yellow('Loading data...'));
    const data = loadStoredData(options.data);
    console.log(kleur.gray(`Loaded ${data.markets.length} markets\n`));

    const config: BacktestConfig = {
      initialCapital: parseFloat(options.capital),
      feeRate: parseFloat(options.fee) / 100,
      slippage: 0,
    };

    const results: Array<{ name: string; key: string; result: BacktestResult }> = [];

    for (const strategyKey of TOP_STRATEGIES) {
      const filePath = path.join(strategiesDir, `${strategyKey}.ts`);
      if (!fs.existsSync(filePath)) {
        console.log(kleur.gray(`Skipping ${strategyKey} (file not found)`));
        continue;
      }
      
      try {
        delete require.cache[require.resolve(filePath)];
        const strategyModule = require(filePath);
        
        // Find any exported class that ends with 'Strategy'
        const StrategyClass = Object.values(strategyModule).find(
          (exp): exp is new (...args: any[]) => any => typeof exp === 'function' && typeof exp.name === 'string' && exp.name.endsWith('Strategy')
        );
        
        if (!StrategyClass) {
          console.log(kleur.gray(`Skipping ${strategyKey} (no Strategy class found)`));
          continue;
        }
        
        const params = loadParams(`src/strategies/${strategyKey}.params.json`);
        const strategy = new StrategyClass(params);
        
        process.stdout.write(`${strategyKey.padEnd(40)} `);
        
        const engine = new BacktestEngine(data, strategy, config);
        const result = engine.run();
        
        results.push({ name: strategyKey, key: strategyKey, result });
        const returnPct = (result.totalReturn / config.initialCapital - 1) * 100;
        const color = returnPct > 0 ? kleur.green : kleur.red;
        console.log(color(`${formatCurrency(result.totalReturn)} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%)`));
      } catch (e: any) {
        console.log(kleur.red(`ERROR: ${e.message}`));
      }
    }

    // Sort by total return (descending)
    results.sort((a, b) => b.result.totalReturn - a.result.totalReturn);

    console.log('\n' + kleur.cyan('=== RANKINGS ==='));
    console.log('');

    for (let i = 0; i < results.length; i++) {
      const { name, result } = results[i];
      const returnPct = (result.totalReturn / config.initialCapital - 1) * 100;
      const rankColor = i === 0 ? kleur.green : i < 3 ? kleur.yellow : kleur.white;
      const winRate = result.totalTrades > 0 ? (result.winningTrades / result.totalTrades * 100).toFixed(1) : '0.0';
      
      console.log(
        rankColor(`${(i + 1).toString().padStart(2)}. ${name.padEnd(40)} `) +
        `${formatCurrency(result.totalReturn).padStart(12)} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%)` +
        ` | Trades: ${result.totalTrades.toString().padStart(5)} | Win: ${winRate}%`
      );
    }

    if (results.length > 0) {
      const best = results[0];
      const bestWinRate = best.result.totalTrades > 0 ? (best.result.winningTrades / best.result.totalTrades * 100).toFixed(2) : '0.00';
      console.log('');
      console.log(kleur.green(`★ Best Strategy: ${best.name}`));
      console.log(`  Return: ${formatCurrency(best.result.totalReturn)} (${((best.result.totalReturn / config.initialCapital - 1) * 100).toFixed(2)}%)`);
      console.log(`  Trades: ${best.result.totalTrades}`);
      console.log(`  Win Rate: ${bestWinRate}%`);
      console.log(`  Sharpe: ${best.result.sharpeRatio?.toFixed(3) || 'N/A'}`);
      console.log(`  Max DD: ${(best.result.maxDrawdown * 100).toFixed(2)}%`);
    }
  });

program.parse();
