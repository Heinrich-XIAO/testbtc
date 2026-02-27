import kleur from 'kleur';
import { loadStoredData, BacktestEngine } from './src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

const DATASET = 'data/stock-data.json';

// Test ALL iter strategies from 168-200
async function main() {
  console.log(kleur.cyan('MASS TEST: Iterations 168-200'));
  console.log(kleur.cyan('===============================\n'));

  const strategiesDir = 'src/strategies';
  const files = fs.readdirSync(strategiesDir)
    .filter(f => f.match(/^strat_iter(16[89]|17[0-9]|18[0-9]|19[0-9]|200)_.*\.ts$/))
    .filter(f => !f.includes('.optimization'));

  console.log(`Found ${files.length} strategies to test\n`);
  
  const data = loadStoredData(DATASET);
  const results: any[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(process.cwd(), strategiesDir, file);
    
    process.stdout.write(`[${i + 1}/${files.length}] ${file.replace('.ts', '').padEnd(25)} `);
    
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
      const returnPct = ((ret / 1000) - 1) * 100;
      const color = ret > 1000 ? kleur.green : ret > 0 ? kleur.yellow : kleur.red;
      
      console.log(color(`$${ret.toFixed(2).padStart(10)} (${returnPct.toFixed(1)}%) | ${result.totalTrades.toString().padStart(6)} trades`));
      
      results.push({
        file: file.replace('.ts', ''),
        return: ret,
        returnPct,
        trades: result.totalTrades,
        winRate: result.totalTrades > 0 ? (result.winningTrades / result.totalTrades) * 100 : 0
      });
    } catch (e) {
      console.log(kleur.red('error'));
    }
  }

  // Save results
  fs.writeFileSync('mass-test-results.json', JSON.stringify(results, null, 2));

  // Show top 10
  console.log(kleur.cyan('\n=== TOP 10 STRATEGIES ===\n'));
  results.sort((a, b) => b.return - a.return);
  
  for (let i = 0; i < Math.min(10, results.length); i++) {
    const r = results[i];
    const color = r.return > 1000 ? kleur.green : r.return > 0 ? kleur.yellow : kleur.red;
    console.log(color(`${(i + 1).toString().padStart(2)}. ${r.file.padEnd(25)} $${r.return.toFixed(2)} (${r.returnPct.toFixed(1)}%) | ${r.trades} trades`));
  }

  const profitable = results.filter(r => r.return > 1000).length;
  console.log(kleur.gray(`\nTotal: ${results.length}, Profitable: ${profitable}, Failed: ${results.length - profitable}`));
}

main().catch(console.error);
