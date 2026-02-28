import kleur from 'kleur';
import { loadStoredData, BacktestEngine } from './src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

const DATASET = 'data/stock-data.json';

async function main() {
  console.log(kleur.cyan('MASS TEST: ITERATIONS 211-300'));
  console.log(kleur.cyan('==============================\n'));

  const files = fs.readdirSync('src/strategies')
    .filter(f => f.match(/^strat_iter(2[1-9][1-9]|300)_.*\.ts$/)) // 211-300
    .filter(f => !f.includes('.optimization'));

  console.log(`Testing ${files.length} strategies...\n`);
  
  const data = loadStoredData(DATASET);
  const results: any[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(process.cwd(), 'src/strategies', file);
    
    if (i % 10 === 0) process.stdout.write(`\n[${i}/${files.length}] `);
    process.stdout.write('.');
    
    try {
      delete require.cache[require.resolve(filePath)];
      const module = require(filePath);
      
      const StrategyClass = Object.values(module).find(
        (exp: any) => typeof exp === 'function' && exp.name?.endsWith('Strategy')
      ) as any;
      
      if (!StrategyClass) continue;

      const strategy = new StrategyClass({});
      const engine = new BacktestEngine(data, strategy, { 
        initialCapital: 1000, 
        feeRate: 0.001, 
        slippage: 0 
      });
      
      const result = engine.run();
      
      results.push({
        file: file.replace('.ts', ''),
        return: result.totalReturn,
        trades: result.totalTrades,
      });
    } catch (e) {}
  }

  console.log('\n\n');
  
  // Sort and show top 20
  results.sort((a, b) => b.return - a.return);
  
  console.log(kleur.cyan('=== TOP 20 STRATEGIES ===\n'));
  
  for (let i = 0; i < Math.min(20, results.length); i++) {
    const r = results[i];
    const color = r.return > 1000 ? kleur.green : kleur.red;
    console.log(color(`${(i+1).toString().padStart(2)}. ${r.file.padEnd(20)} $${r.return.toFixed(2).padStart(10)} | ${r.trades.toString().padStart(6)} trades`));
  }

  // Stats
  const profitable = results.filter(r => r.return > 1000).length;
  const beat207d = results.filter(r => r.return > 1100).length;
  
  console.log(kleur.cyan('\n=== STATS ==='));
  console.log(kleur.gray(`Winner strat_iter207_d: $1100.18`));
  console.log(kleur.gray(`Total tested: ${results.length}`));
  console.log(kleur.green(`Profitable: ${profitable}`));
  console.log(kleur.yellow(`Beat 207_d: ${beat207d}`));
  
  fs.writeFileSync('iter211-300-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
