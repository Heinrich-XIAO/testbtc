import { Command } from 'commander';
import kleur from 'kleur';
import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import type { BacktestConfig, BacktestResult } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

const DEFAULT_DATA_FILE = 'data/stock-data.json';

// Base strategies (non-iter)
const BASE_STRATEGIES = [
  { file: 'strat_simple_ma_01', class: 'SimpleMAStrategy', name: 'Simple MA' },
  { file: 'strat_stoch_baseline_01', class: 'StochBaseline01Strategy', name: 'Stoch Baseline 01' },
  { file: 'strat_stoch_baseline_02', class: 'StochBaseline02Strategy', name: 'Stoch Baseline 02' },
  { file: 'strat_stoch_baseline_03', class: 'StochBaseline03Strategy', name: 'Stoch Baseline 03' },
  { file: 'strat_sr_stoch_01', class: 'SrStoch01Strategy', name: 'SR Stoch 01' },
  { file: 'strat_sr_stoch_02', class: 'SrStoch02Strategy', name: 'SR Stoch 02' },
  { file: 'strat_sr_stoch_03', class: 'SrStoch03Strategy', name: 'SR Stoch 03' },
  { file: 'strat_grid', class: 'StratGridStrategy', name: 'Grid Strategy' },
];

function formatCurrency(value: number): string {
  return '$' + value.toFixed(2);
}

const program = new Command();

program
  .name('backtest-base')
  .description('Backtest base strategies (non-iteration)')
  .option('-d, --data <file>', 'Data file path', DEFAULT_DATA_FILE)
  .option('-c, --capital <number>', 'Initial capital in USD', '1000')
  .option('-f, --fee <percent>', 'Fee rate as percentage', '0')
  .action(async (options) => {
    console.log(kleur.cyan('Base Strategies Backtest'));
    console.log(kleur.cyan('========================'));
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

    const results: Array<{ name: string; result: BacktestResult }> = [];

    for (const strat of BASE_STRATEGIES) {
      const filePath = path.join(strategiesDir, `${strat.file}.ts`);
      if (!fs.existsSync(filePath)) {
        console.log(kleur.gray(`Skipping ${strat.name} (file not found)`));
        continue;
      }
      
      try {
        delete require.cache[require.resolve(filePath)];
        const strategyModule = require(filePath);
        const StrategyClass = strategyModule[strat.class];
        
        if (!StrategyClass) {
          console.log(kleur.gray(`Skipping ${strat.name} (class not found)`));
          continue;
        }
        
        const strategy = new StrategyClass({});
        
        process.stdout.write(`${strat.name.padEnd(25)} `);
        
        const engine = new BacktestEngine(data, strategy, config);
        const result = engine.run();
        
        results.push({ name: strat.name, result });
        const returnPct = (result.totalReturn / config.initialCapital - 1) * 100;
        const color = returnPct > 0 ? kleur.green : kleur.red;
        console.log(color(`${formatCurrency(result.totalReturn).padStart(12)} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%) | Trades: ${result.totalTrades}`));
      } catch (e: any) {
        console.log(kleur.red(`ERROR: ${e.message}`));
      }
    }

    // Sort by total return
    results.sort((a, b) => b.result.totalReturn - a.result.totalReturn);

    console.log('\n' + kleur.cyan('=== RANKINGS ==='));
    console.log('');

    for (let i = 0; i < results.length; i++) {
      const { name, result } = results[i];
      const returnPct = (result.totalReturn / config.initialCapital - 1) * 100;
      const rankColor = i === 0 ? kleur.green : i < 3 ? kleur.yellow : kleur.white;
      const winRate = result.totalTrades > 0 ? (result.winningTrades / result.totalTrades * 100).toFixed(1) : '0.0';
      
      console.log(
        rankColor(`${(i + 1).toString().padStart(2)}. ${name.padEnd(25)} `) +
        `${formatCurrency(result.totalReturn).padStart(12)} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%)` +
        ` | Trades: ${result.totalTrades.toString().padStart(6)} | Win: ${winRate}%`
      );
    }

    if (results.length > 0) {
      const best = results[0];
      const bestWinRate = best.result.totalTrades > 0 ? (best.result.winningTrades / best.result.totalTrades * 100).toFixed(2) : '0.00';
      console.log('');
      console.log(kleur.green(`★ Best: ${best.name}`));
      console.log(`  Return: ${formatCurrency(best.result.totalReturn)} (${((best.result.totalReturn / config.initialCapital - 1) * 100).toFixed(2)}%)`);
      console.log(`  Trades: ${best.result.totalTrades}`);
      console.log(`  Win Rate: ${bestWinRate}%`);
      console.log(`  Sharpe: ${best.result.sharpeRatio?.toFixed(3) || 'N/A'}`);
      console.log(`  Max DD: ${(best.result.maxDrawdown * 100).toFixed(2)}%`);
    }
  });

program.parse();
