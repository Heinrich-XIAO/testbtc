import kleur from 'kleur';
import { loadStoredData, BacktestEngine } from './src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

// Test strat_iter207_d on 10-year dataset
async function main() {
  console.log(kleur.cyan('TESTING WINNER ON 10-YEAR DATASET'));
  console.log(kleur.cyan('==================================\n'));
  console.log('Strategy: strat_iter207_d');
  console.log('Parameters: 2% drop, 12% stop, 30% profit, 25 hold, 30% risk\n');

  const dataDir = 'data';
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && !f.includes('stock-data') && !f.includes('crypto'));
  
  console.log(`Found ${files.length} stock files\n`);
  
  // Build markets and priceHistory manually
  const markets: any[] = [];
  const priceHistory: Record<string, { t: number; p: number }[]> = {};
  let totalPoints = 0;

  for (const file of files.slice(0, 500)) { // Limit to 500 for speed
    try {
      const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
      const data = JSON.parse(content);
      
      if (!Array.isArray(data) || data.length === 0) continue;
      
      const ticker = file.replace('.json', '');
      const tokenId = `stock_${ticker}`;
      
      markets.push({
        ticker,
        condition_id: tokenId,
        description: `Stock ${ticker}`,
        tokens: [{ outcome: ticker, token_id: tokenId, price: 0.5, winner: false }]
      });
      
      priceHistory[tokenId] = data.map((d: any) => ({
        t: new Date(d.date).getTime(),
        p: d.close
      }));
      
      totalPoints += data.length;
    } catch (e) {
      // Skip invalid files
    }
  }

  const data = {
    markets,
    priceHistory: new Map(Object.entries(priceHistory)),
    priceHistorySize: totalPoints
  };

  console.log(kleur.gray(`Loaded ${markets.length} markets, ${totalPoints} price points`));
  console.log(kleur.gray(`Date range: ~10 years\n`));

  // Load strategy
  const strategyPath = path.join(process.cwd(), 'src/strategies/strat_iter207_d.ts');
  delete require.cache[require.resolve(strategyPath)];
  const module = require(strategyPath);
  const StrategyClass = Object.values(module).find(
    (exp: any) => typeof exp === 'function' && exp.name?.endsWith('Strategy')
  ) as any;

  const strategy = new StrategyClass({});
  
  // Test with 0.1% fees
  const engine = new BacktestEngine(data as any, strategy, {
    initialCapital: 1000,
    feeRate: 0.001,
    slippage: 0
  });

  console.log(kleur.yellow('Running backtest...\n'));
  const result = engine.run();

  console.log(kleur.cyan('=== RESULTS ON 10-YEAR DATA ===\n'));
  
  const returnPct = ((result.totalReturn / 1000) - 1) * 100;
  const color = result.totalReturn > 1000 ? kleur.green : kleur.red;
  
  console.log(color(`Final Capital: $${result.totalReturn.toFixed(2)}`));
  console.log(color(`Return: ${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`));
  console.log(`Total Trades: ${result.totalTrades}`);
  console.log(`Win Rate: ${result.totalTrades > 0 ? (result.winningTrades / result.totalTrades * 100).toFixed(1) : 0}%`);
  console.log(`Max Drawdown: ${(result.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`Sharpe Ratio: ${result.sharpeRatio?.toFixed(3) || 'N/A'}`);

  console.log(kleur.cyan('\n=== COMPARISON ==='));
  console.log(kleur.gray('5-year result: $1100.18 (+10.0%)'));
  console.log(kleur.gray('10-year result: ') + color(`$${result.totalReturn.toFixed(2)} (${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%)`));
  
  if (result.totalReturn > 1000) {
    console.log(kleur.green('\n✅ STRATEGY VALIDATED - Profitable on 10-year dataset!'));
  } else {
    console.log(kleur.red('\n❌ Strategy failed on 10-year data - possible overfitting'));
  }
}

main().catch(console.error);
