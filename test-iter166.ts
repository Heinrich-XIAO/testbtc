import kleur from 'kleur';
import { loadStoredData, BacktestEngine } from './src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

const DATASET = 'data/stock-data.json';

const STRATEGIES = [
  { file: 'strat_iter166_a', name: 'Fixed Position Count (min hold)' },
  { file: 'strat_iter166_b', name: 'Larger Position Sizing' },
  { file: 'strat_iter166_c', name: 'Cooldown Period' },
  { file: 'strat_iter166_d', name: 'Top N Markets Only' },
  { file: 'strat_iter166_e', name: 'Consecutive Loss Limit' },
];

async function testStrategy(strategyInfo: typeof STRATEGIES[0], data: any) {
  const strategiesDir = path.join(process.cwd(), 'src/strategies');
  const filePath = path.join(strategiesDir, `${strategyInfo.file}.ts`);
  const paramsPath = path.join(strategiesDir, `${strategyInfo.file}.params.json`);
  
  try {
    delete require.cache[require.resolve(filePath)];
    const module = require(filePath);
    
    const StrategyClass = Object.values(module).find(
      (exp: any) => typeof exp === 'function' && exp.name && exp.name.endsWith('Strategy')
    ) as any;
    
    if (!StrategyClass) return null;

    let params = {};
    if (fs.existsSync(paramsPath)) {
      params = JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
    }

    const strategy = new StrategyClass(params);
    const engine = new BacktestEngine(data, strategy, {
      initialCapital: 1000,
      feeRate: 0.001,
      slippage: 0
    });
    
    const result = engine.run();
    
    return {
      strategy: strategyInfo.name,
      return: result.totalReturn,
      trades: result.totalTrades,
      winRate: result.totalTrades > 0 ? (result.winningTrades / result.totalTrades) * 100 : 0,
    };
  } catch (e: any) {
    return null;
  }
}

async function main() {
  console.log(kleur.cyan('ITERATION 166 - Testing 5 Fee-Survival Strategies'));
  console.log(kleur.cyan('=================================================\n'));
  console.log('Testing with 0.1% fees\n');

  const data = loadStoredData(DATASET);
  console.log(kleur.gray(`Loaded ${data.markets.length} markets\n`));

  const results: any[] = [];

  for (const strat of STRATEGIES) {
    process.stdout.write(`${strat.name.padEnd(40)} `);
    
    const result = await testStrategy(strat, data);
    
    if (result) {
      const returnPct = ((result.return / 1000) - 1) * 100;
      const color = result.return > 1000 ? kleur.green : kleur.red;
      console.log(color(`$${result.return.toFixed(2).padStart(10)} (${returnPct.toFixed(1)}%) | ${result.trades.toString().padStart(6)} trades | ${result.winRate.toFixed(1)}% win`));
      results.push(result);
    } else {
      console.log(kleur.red('FAILED'));
    }
  }

  console.log(kleur.cyan('\n=== RESULTS RANKING ===\n'));
  
  const sorted = [...results].sort((a, b) => b.return - a.return);
  
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const returnPct = ((r.return / 1000) - 1) * 100;
    const color = r.return > 1000 ? kleur.green : kleur.red;
    console.log(
      color(`${(i + 1)}. ${r.strategy.padEnd(40)} $${r.return.toFixed(2)} (${returnPct.toFixed(1)}%) | ${r.trades} trades`)
    );
  }

  const profitable = sorted.filter(r => r.return > 1000);
  console.log(kleur.gray(`\nProfitable with 0.1% fees: ${profitable.length}/${results.length}`));
  
  if (profitable.length > 0) {
    console.log(kleur.green('\n✅ FOUND PROFITABLE STRATEGIES!'));
  } else {
    console.log(kleur.red('\n❌ All strategies failed with fees'));
  }
}

main().catch(console.error);
