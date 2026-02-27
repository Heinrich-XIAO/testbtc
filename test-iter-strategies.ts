import kleur from 'kleur';
import { loadStoredData, BacktestEngine } from './src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

const DATASET = 'data/stock-data.json';
const RESULTS_FILE = 'backtest-results-iter.json';

interface Result {
  strategy: string;
  return: number;
  trades: number;
  winRate: number;
  sharpe: number;
  maxDrawdown: number;
}

function loadResults(): Result[] {
  if (fs.existsSync(RESULTS_FILE)) {
    return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  }
  return [];
}

function saveResults(results: Result[]) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

function getTestedStrategies(): string[] {
  return loadResults().map(r => r.strategy);
}

function discoverIterStrategies(): string[] {
  const strategiesDir = 'src/strategies';
  const files = fs.readdirSync(strategiesDir);
  return files
    .filter(f => {
      // Match strat_iter followed by number, but NOT _stock
      return f.match(/^strat_iter\d+.*\.ts$/) && !f.includes('_stock') && !f.includes('.optimization');
    })
    .map(f => f.replace('.ts', ''))
    .sort();
}

async function testStrategy(strategyFile: string, data: any): Promise<Result[]> {
  const strategiesDir = path.join(process.cwd(), 'src/strategies');
  const filePath = path.join(strategiesDir, `${strategyFile}.ts`);
  const results: Result[] = [];
  
  try {
    delete require.cache[require.resolve(filePath)];
    const module = require(filePath);
    
    // Find ALL Strategy classes in the file
    const StrategyClasses = Object.values(module).filter(
      (exp: any) => typeof exp === 'function' && exp.name && exp.name.endsWith('Strategy')
    ) as any[];
    
    for (const StrategyClass of StrategyClasses) {
      try {
        const strategy = new StrategyClass({});
        const engine = new BacktestEngine(data, strategy, {
          initialCapital: 1000,
          feeRate: 0.001,
          slippage: 0
        });
        
        const result = engine.run();
        
        results.push({
          strategy: StrategyClass.name.replace('Strategy', ''),
          return: result.totalReturn,
          trades: result.totalTrades,
          winRate: result.totalTrades > 0 ? (result.winningTrades / result.totalTrades) * 100 : 0,
          sharpe: result.sharpeRatio || 0,
          maxDrawdown: result.maxDrawdown * 100
        });
      } catch (e) {
        // Skip failed strategies
      }
    }
  } catch (e) {
    // Skip failed files
  }
  
  return results;
}

async function main() {
  console.log(kleur.cyan('Testing Non-Stock Iter Strategies (with 0.1% fees)'));
  console.log(kleur.cyan('===================================================\n'));

  const strategies = discoverIterStrategies();
  const tested = getTestedStrategies();
  const remaining = strategies.filter(s => !tested.includes(s));

  console.log(`Total iter strategies: ${strategies.length}`);
  console.log(`Already tested: ${tested.length}`);
  console.log(`Remaining: ${remaining.length}\n`);

  if (remaining.length === 0) {
    showResults();
    return;
  }

  console.log(kleur.yellow('Loading data...'));
  const data = loadStoredData(DATASET);
  console.log(kleur.gray(`Loaded ${data.markets.length} markets\n`));

  // Test batch of 20
  const BATCH_SIZE = 20;
  const batch = remaining.slice(0, BATCH_SIZE);

  for (let i = 0; i < batch.length; i++) {
    const strategyFile = batch[i];
    process.stdout.write(`[${i + 1}/${batch.length}] ${strategyFile.padEnd(30)} `);
    
    const fileResults = await testStrategy(strategyFile, data);
    
    if (fileResults.length > 0) {
      const bestInFile = fileResults.reduce((a, b) => a.return > b.return ? a : b);
      const color = bestInFile.return > 1000 ? kleur.green : bestInFile.return > 0 ? kleur.yellow : kleur.gray;
      console.log(color(`$${bestInFile.return.toFixed(2).padStart(10)} | ${bestInFile.trades.toString().padStart(5)} trades`));
      
      const results = loadResults();
      results.push(...fileResults);
      saveResults(results);
    } else {
      console.log(kleur.red('FAILED'));
    }
  }

  showResults();
  
  const remainingAfter = remaining.length - BATCH_SIZE;
  if (remainingAfter > 0) {
    console.log(kleur.yellow(`\n${remainingAfter} strategies remaining. Run again to continue.`));
  }
}

function showResults() {
  const results = loadResults();
  
  // Sort by return
  const sorted = [...results].sort((a, b) => b.return - a.return);
  
  console.log(kleur.cyan('\n\n=== TOP 20 STRATEGIES ===\n'));
  
  for (let i = 0; i < Math.min(20, sorted.length); i++) {
    const r = sorted[i];
    const color = r.return > 1500 ? kleur.green : r.return > 1000 ? kleur.yellow : kleur.white;
    console.log(
      color(`${(i + 1).toString().padStart(2)}. ${r.strategy.padEnd(30)} `) +
      `$${r.return.toFixed(2).padStart(10)} | ${r.trades.toString().padStart(6)} trades | ${r.winRate.toFixed(1)}% win`
    );
  }
  
  // Stats
  const profitable = results.filter(r => r.return > 1000).length;
  console.log(kleur.gray(`\nTotal tested: ${results.length}`));
  console.log(kleur.green(`Profitable: ${profitable}`));
  console.log(kleur.red(`Unprofitable: ${results.length - profitable}`));
}

main().catch(console.error);
