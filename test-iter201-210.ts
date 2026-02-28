import kleur from 'kleur';
import { loadStoredData, BacktestEngine } from './src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

const DATASET = 'data/stock-data.json';

async function main() {
  console.log(kleur.cyan('TESTING ITERATIONS 201-210 (Simple Drop Strategies)'));
  console.log(kleur.cyan('====================================================\n'));

  const files = fs.readdirSync('src/strategies')
    .filter(f => f.match(/^strat_iter20[1-9].*\.ts$/) && !f.includes('.optimization'));

  console.log(`Found ${files.length} strategies\n`);
  
  const data = loadStoredData(DATASET);
  const results: any[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(process.cwd(), 'src/strategies', file);
    
    process.stdout.write(`[${(i+1).toString().padStart(2)}/${files.length}] ${file.replace('.ts','').padEnd(20)} `);
    
    try {
      delete require.cache[require.resolve(filePath)];
      const module = require(filePath);
      
      const StrategyClass = Object.values(module).find(
        (exp: any) => typeof exp === 'function' && exp.name?.endsWith('Strategy')
      ) as any;
      
      if (!StrategyClass) {
        console.log(kleur.gray('no class'));
        continue;
      }

      const strategy = new StrategyClass({});
      const engine = new BacktestEngine(data, strategy, { 
        initialCapital: 1000, 
        feeRate: 0.001, 
        slippage: 0 
      });
      
      const result = engine.run();
      const ret = result.totalReturn;
      const color = ret > 1000 ? kleur.green : kleur.red;
      
      console.log(color(`$${ret.toFixed(2).padStart(10)} | ${result.totalTrades.toString().padStart(6)} trades`));
      
      results.push({
        file: file.replace('.ts', ''),
        return: ret,
        trades: result.totalTrades,
        winRate: result.totalTrades > 0 ? (result.winningTrades / result.totalTrades) * 100 : 0
      });
    } catch (e) {
      console.log(kleur.red('error'));
    }
  }

  // Sort and show top 15
  results.sort((a, b) => b.return - a.return);
  
  console.log(kleur.cyan('\n=== TOP 15 STRATEGIES ===\n'));
  
  for (let i = 0; i < Math.min(15, results.length); i++) {
    const r = results[i];
    const color = r.return > 1000 ? kleur.green : kleur.red;
    console.log(color(`${(i+1).toString().padStart(2)}. ${r.file.padEnd(20)} $${r.return.toFixed(2)} | ${r.trades} trades`));
  }

  // Show comparison to 013
  console.log(kleur.cyan('\n=== COMPARISON ==='));
  console.log(kleur.gray('StratIterStock013: $813.39 (-18.7%) | 161141 trades'));
  
  const profitable = results.filter(r => r.return > 1000).length;
  const beat013 = results.filter(r => r.return > 813).length;
  
  console.log(kleur.gray(`\nTotal: ${results.length}`));
  console.log(kleur.green(`Profitable: ${profitable}`));
  console.log(kleur.yellow(`Beat 013: ${beat013}`));
  
  // Save results
  fs.writeFileSync('iter201-210-results.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
