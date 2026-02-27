import kleur from 'kleur';
import { loadStoredData, BacktestEngine } from './src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

const DATASET = 'data/stock-data.json';

const STRATEGIES = [
  { file: 'strat_iter167_a', name: 'Market Rotation' },
  { file: 'strat_iter167_b', name: 'Gap Trading' },
  { file: 'strat_iter167_c', name: 'Breakout Pullback' },
  { file: 'strat_iter167_d', name: 'Range Trading' },
  { file: 'strat_iter167_e', name: 'Opening Range Breakout' },
];

async function testStrategy(info: typeof STRATEGIES[0], data: any) {
  const filePath = path.join(process.cwd(), 'src/strategies', `${info.file}.ts`);
  try {
    delete require.cache[require.resolve(filePath)];
    const module = require(filePath);
    const StrategyClass = Object.values(module).find(
      (exp: any) => typeof exp === 'function' && exp.name?.endsWith('Strategy')
    ) as any;
    if (!StrategyClass) return null;
    
    const strategy = new StrategyClass({});
    const engine = new BacktestEngine(data, strategy, { initialCapital: 1000, feeRate: 0.001, slippage: 0 });
    const result = engine.run();
    
    return {
      name: info.name,
      return: result.totalReturn,
      trades: result.totalTrades,
      winRate: result.totalTrades > 0 ? (result.winningTrades / result.totalTrades) * 100 : 0
    };
  } catch (e) { return null; }
}

async function main() {
  console.log(kleur.cyan('ITERATION 167'));
  const data = loadStoredData(DATASET);
  console.log(`Markets: ${data.markets.length}\n`);
  
  const results: any[] = [];
  for (const strat of STRATEGIES) {
    process.stdout.write(`${strat.name.padEnd(25)} `);
    const r = await testStrategy(strat, data);
    if (r) {
      const color = r.return > 1000 ? kleur.green : kleur.red;
      console.log(color(`$${r.return.toFixed(2)} | ${r.trades} trades | ${r.winRate.toFixed(1)}% win`));
      results.push(r);
    } else console.log(kleur.red('FAILED'));
  }
  
  console.log(kleur.cyan('\nRanking:'));
  results.sort((a,b) => b.return - a.return);
  results.forEach((r, i) => {
    const color = r.return > 1000 ? kleur.green : kleur.red;
    console.log(color(`${i+1}. ${r.name.padEnd(25)} $${r.return.toFixed(2)} | ${r.trades} trades`));
  });
  
  const profitable = results.filter(r => r.return > 1000).length;
  console.log(`\nProfitable: ${profitable}/${results.length}`);
}

main();
