import kleur from 'kleur';
import { loadStoredData } from './src/backtest/engine';
import { BacktestEngine } from './src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

kleur.enabled = true;

const RESULTS_FILE = 'optimization-results.json';
const DATASET = 'data/stock-data.json';

interface Result {
  strategy: string;
  return: number;
  trades: number;
  winRate: number;
  sharpe: number;
  maxDrawdown: number;
  timestamp: string;
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

function getOptimizedStrategies(): string[] {
  const results = loadResults();
  return results.map(r => r.strategy);
}

function discoverStrategies(): string[] {
  const strategiesDir = 'src/strategies';
  const files = fs.readdirSync(strategiesDir);
  return files
    .filter(f => f.endsWith('.optimization.ts'))
    .map(f => f.replace('.optimization.ts', ''))
    .sort();
}

async function main() {
  console.log(kleur.cyan('Batch Strategy Optimization'));
  console.log(kleur.cyan('============================\n'));

  const allStrategies = discoverStrategies();
  const completed = getOptimizedStrategies();
  const remaining = allStrategies.filter(s => !completed.includes(s));

  console.log(`Total strategies: ${allStrategies.length}`);
  console.log(`Completed: ${completed.length}`);
  console.log(`Remaining: ${remaining.length}\n`);

  if (remaining.length === 0) {
    console.log(kleur.green('All strategies optimized!'));
    showTopResults();
    return;
  }

  // Process in batches
  const BATCH_SIZE = 5;
  const batch = remaining.slice(0, BATCH_SIZE);

  console.log(`Processing batch of ${batch.length} strategies...\n`);

  for (const strategy of batch) {
    console.log(kleur.yellow(`Optimizing: ${strategy}`));
    
    try {
      // Run optimization
      const output = execSync(
        `bun run scripts/run-optimization.ts ${strategy} --dataset ${DATASET} --fast`,
        { encoding: 'utf-8', timeout: 120000 }
      );

      // Parse result from output
      const returnMatch = output.match(/Total Return:\s*\$?([\d.]+)/);
      const tradesMatch = output.match(/Total Trades:\s*(\d+)/);
      const winRateMatch = output.match(/Win Rate:\s*([\d.]+)%/);
      const sharpeMatch = output.match(/Sharpe:\s*([\d.]+)/);
      const ddMatch = output.match(/Max DD:\s*([\d.]+)%/);

      const result: Result = {
        strategy,
        return: parseFloat(returnMatch?.[1] || '0'),
        trades: parseInt(tradesMatch?.[1] || '0'),
        winRate: parseFloat(winRateMatch?.[1] || '0'),
        sharpe: parseFloat(sharpeMatch?.[1] || '0'),
        maxDrawdown: parseFloat(ddMatch?.[1] || '0'),
        timestamp: new Date().toISOString()
      };

      const results = loadResults();
      results.push(result);
      saveResults(results);

      const color = result.return > 0 ? kleur.green : kleur.red;
      console.log(color(`  Result: $${result.return.toFixed(2)}, ${result.trades} trades, ${result.winRate.toFixed(1)}% win\n`));

    } catch (e) {
      console.log(kleur.red(`  Failed: ${e}\n`));
      
      // Save failure
      const results = loadResults();
      results.push({
        strategy,
        return: 0,
        trades: 0,
        winRate: 0,
        sharpe: 0,
        maxDrawdown: 0,
        timestamp: new Date().toISOString()
      });
      saveResults(results);
    }
  }

  showTopResults();
  
  if (remaining.length > BATCH_SIZE) {
    console.log(kleur.yellow(`\n${remaining.length - BATCH_SIZE} strategies remaining. Run again to continue.`));
  }
}

function showTopResults() {
  const results = loadResults();
  
  // Sort by return
  const sorted = [...results].sort((a, b) => b.return - a.return);
  
  console.log(kleur.cyan('\n=== TOP 10 STRATEGIES ===\n'));
  
  for (let i = 0; i < Math.min(10, sorted.length); i++) {
    const r = sorted[i];
    const color = r.return > 1000 ? kleur.green : r.return > 0 ? kleur.yellow : kleur.gray;
    console.log(
      color(`${(i + 1).toString().padStart(2)}. ${r.strategy.padEnd(30)} `) +
      `$${r.return.toFixed(2).padStart(10)} | ${r.trades.toString().padStart(5)} trades | ${r.winRate.toFixed(1)}% win`
    );
  }
}

main().catch(console.error);
