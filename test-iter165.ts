import kleur from 'kleur';
import { loadStoredData, BacktestEngine } from './src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

kleur.enabled = true;

const DATASET = 'data/stock-data.json';
const RESULTS_FILE = 'iter165-results.json';

interface Result {
  strategy: string;
  return: number;
  trades: number;
  winRate: number;
  params: Record<string, number>;
}

const STRATEGIES = [
  { file: 'strat_iter165_a', name: 'Higher Timeframe (Weekly)' },
  { file: 'strat_iter165_b', name: 'Volume Confirmation' },
  { file: 'strat_iter165_c', name: 'Multi-Bar Confirmation' },
  { file: 'strat_iter165_d', name: 'Volatility Filter' },
  { file: 'strat_iter165_e', name: 'Trend Following' },
];

async function testStrategy(strategyInfo: typeof STRATEGIES[0], data: any): Promise<Result | null> {
  const strategiesDir = path.join(process.cwd(), 'src/strategies');
  const filePath = path.join(strategiesDir, `${strategyInfo.file}.ts`);
  const paramsPath = path.join(strategiesDir, `${strategyInfo.file}.params.json`);
  
  try {
    delete require.cache[require.resolve(filePath)];
    const module = require(filePath);
    
    // Find Strategy class
    const StrategyClass = Object.values(module).find(
      (exp: any) => typeof exp === 'function' && exp.name && exp.name.endsWith('Strategy')
    ) as any;
    
    if (!StrategyClass) return null;

    // Load params if available
    let params = {};
    if (fs.existsSync(paramsPath)) {
      params = JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
    }

    const strategy = new StrategyClass(params);
    const engine = new BacktestEngine(data, strategy, {
      initialCapital: 1000,
      feeRate: 0.001, // 0.1% fees
      slippage: 0
    });
    
    const result = engine.run();
    
    return {
      strategy: strategyInfo.name,
      return: result.totalReturn,
      trades: result.totalTrades,
      winRate: result.totalTrades > 0 ? (result.winningTrades / result.totalTrades) * 100 : 0,
      params
    };
  } catch (e: any) {
    console.log(kleur.red(`Error: ${e.message}`));
    return null;
  }
}

async function main() {
  console.log(kleur.cyan('ITERATION 165 - Testing All 5 Strategies'));
  console.log(kleur.cyan('=========================================\n'));
  console.log('Testing with 0.1% fees (realistic broker fees)\n');

  const data = loadStoredData(DATASET);
  console.log(kleur.gray(`Loaded ${data.markets.length} markets\n`));

  const results: Result[] = [];

  for (const strat of STRATEGIES) {
    process.stdout.write(`${strat.name.padEnd(30)} `);
    
    const result = await testStrategy(strat, data);
    
    if (result) {
      const returnPct = ((result.return / 1000) - 1) * 100;
      const color = result.return > 1000 ? kleur.green : kleur.red;
      console.log(color(`$${result.return.toFixed(2).padStart(10)} (${returnPct.toFixed(1)}%) | ${result.trades} trades | ${result.winRate.toFixed(1)}% win`));
      results.push(result);
    } else {
      console.log(kleur.red('FAILED'));
    }
  }

  // Save results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  // Show ranking
  console.log(kleur.cyan('\n=== RESULTS RANKING ===\n'));
  
  const sorted = [...results].sort((a, b) => b.return - a.return);
  
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const returnPct = ((r.return / 1000) - 1) * 100;
    const color = r.return > 1000 ? kleur.green : kleur.red;
    console.log(
      color(`${(i + 1)}. ${r.strategy.padEnd(30)} $${r.return.toFixed(2)} (${returnPct.toFixed(1)}%) | ${r.trades} trades`)
    );
  }

  // Compare to best known
  console.log(kleur.cyan('\n=== COMPARISON TO BEST KNOWN ==='));
  console.log(kleur.gray('StratIterStock013 (baseline): $1205.57 (+20.6%) | 161141 trades | 0% fees'));
  console.log(kleur.gray('StratIterStock013 (0.1% fees): $813.39 (-18.7%) | 161141 trades'));
  console.log('');
  
  const profitable = sorted.filter(r => r.return > 1000);
  if (profitable.length > 0) {
    console.log(kleur.green(`Profitable strategies with fees: ${profitable.length}/${results.length}`));
  } else {
    console.log(kleur.red(`No profitable strategies with 0.1% fees`));
  }
}

main().catch(console.error);
