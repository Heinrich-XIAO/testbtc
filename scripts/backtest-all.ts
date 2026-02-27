import { Command } from 'commander';
import kleur from 'kleur';
import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import type { Strategy, BacktestConfig, BacktestResult } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

const DEFAULT_DATA_FILE = 'data/stock-data.json';

// Auto-discover all available strategies
function discoverStrategies(): Record<string, { name: string; class: any; paramsFile: string }> {
  const strategies: Record<string, { name: string; class: any; paramsFile: string }> = {};
  const strategiesDir = path.join(__dirname, '../src/strategies');
  
  try {
    const files = fs.readdirSync(strategiesDir);
    for (const file of files) {
      if (!file.endsWith('.ts') || file.endsWith('.optimization.ts')) continue;
      
      const baseName = file.replace('.ts', '');
      const className = baseName.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
        .split('').map((c: string, i: number) => i === 0 ? c.toUpperCase() : c).join('') + 'Strategy';
      
      try {
        const modulePath = path.join(strategiesDir, file);
        delete require.cache[require.resolve(modulePath)];
        const strategyModule = require(modulePath);
        const StrategyClass = strategyModule[className] || strategyModule.default;
        
        if (StrategyClass) {
          const paramsFile = `src/strategies/${baseName}.params.json`;
          strategies[baseName] = {
            name: baseName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            class: StrategyClass,
            paramsFile
          };
        }
      } catch (e) {
        // Skip strategies that fail to load
      }
    }
  } catch (e) {
    console.error('Error discovering strategies:', e);
  }
  
  return strategies;
}

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

function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

async function runBacktest(
  strategyKey: string,
  strategyConfig: { name: string; class: any; paramsFile: string },
  data: any,
  config: BacktestConfig
): Promise<BacktestResult> {
  const params = loadParams(strategyConfig.paramsFile);
  const strategy = new strategyConfig.class(params);
  const engine = new BacktestEngine(data, strategy, config);
  return engine.run();
}

const program = new Command();

program
  .name('backtest-all')
  .description('Backtest all available strategies and rank by performance')
  .option('-d, --data <file>', 'Data file path', DEFAULT_DATA_FILE)
  .option('-c, --capital <number>', 'Initial capital in USD', '1000')
  .option('-f, --fee <percent>', 'Fee rate as percentage', '0')
  .option('-l, --limit <number>', 'Limit to top N strategies', '0')
  .action(async (options) => {
    console.log(kleur.cyan('Stock Backtest Runner - All Strategies'));
    console.log(kleur.cyan('======================================'));
    console.log(`Data file:       ${options.data}`);
    console.log(`Initial capital: $${options.capital}`);
    console.log(`Fee rate:        ${options.fee}%`);
    console.log('');

    const strategies = discoverStrategies();
    const strategyNames = Object.keys(strategies).sort();
    
    if (strategyNames.length === 0) {
      console.log(kleur.red('No strategies found!'));
      process.exit(1);
    }
    
    console.log(`Found ${strategyNames.length} strategies\n`);

    try {
      console.log(kleur.yellow('Loading data...'));
      const data = loadStoredData(options.data);
      console.log(kleur.gray(`Loaded ${data.markets.length} markets\n`));

      const config: BacktestConfig = {
        initialCapital: parseFloat(options.capital),
        feeRate: parseFloat(options.fee) / 100,
        slippage: 0,
      };

      const results: Array<{ name: string; key: string; result: BacktestResult }> = [];

      for (const strategyKey of strategyNames) {
        const strategyConfig = strategies[strategyKey];
        process.stdout.write(`${kleur.gray('Testing:')} ${strategyConfig.name.padEnd(40)} `);
        
        try {
          const result = await runBacktest(strategyKey, strategyConfig, data, config);
          results.push({ name: strategyConfig.name, key: strategyKey, result });
          console.log(kleur.green(`${formatCurrency(result.totalReturn)} (${formatPercent(result.totalReturn / config.initialCapital - 1)})`));
        } catch (e: any) {
          console.log(kleur.red('ERROR'));
        }
      }

      // Sort by total return (descending)
      results.sort((a, b) => b.result.totalReturn - a.result.totalReturn);

      console.log('\n' + kleur.cyan('=== RANKINGS ==='));
      console.log('');
      
      const limit = parseInt(options.limit) || results.length;
      const topResults = results.slice(0, limit);

      for (let i = 0; i < topResults.length; i++) {
        const { name, result } = topResults[i];
        const returnPct = (result.totalReturn / config.initialCapital - 1) * 100;
        const rankColor = i === 0 ? kleur.green : i < 3 ? kleur.yellow : kleur.white;
        const winRate = result.totalTrades > 0 ? (result.winningTrades / result.totalTrades * 100).toFixed(1) : '0.0';
        
        console.log(
          rankColor(`${(i + 1).toString().padStart(2)}. ${name.padEnd(35)} `) +
          `${formatCurrency(result.totalReturn).padStart(12)} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%)` +
          ` | Trades: ${result.totalTrades.toString().padStart(4)} | Win: ${winRate}%`
        );
      }

      if (results.length > 0) {
        const best = results[0];
        console.log('');
        const bestWinRate = best.result.totalTrades > 0 ? (best.result.winningTrades / best.result.totalTrades * 100).toFixed(2) : '0.00';
        console.log(kleur.green(`★ Best Strategy: ${best.name}`));
        console.log(`  Return: ${formatCurrency(best.result.totalReturn)} (${((best.result.totalReturn / config.initialCapital - 1) * 100).toFixed(2)}%)`);
        console.log(`  Trades: ${best.result.totalTrades}`);
        console.log(`  Win Rate: ${bestWinRate}%`);
        console.log(`  Sharpe: ${best.result.sharpeRatio?.toFixed(3) || 'N/A'}`);
        console.log(`  Max DD: ${(best.result.maxDrawdown * 100).toFixed(2)}%`);
      }

    } catch (error) {
      console.error(kleur.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program.parse();
