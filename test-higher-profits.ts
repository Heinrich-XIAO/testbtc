import kleur from 'kleur';
import { loadStoredData, BacktestEngine } from './src/backtest/engine';
import * as fs from 'fs';
import * as path from 'path';

// Test higher profit targets
async function main() {
  console.log(kleur.cyan('TESTING HIGHER PROFIT TARGETS'));
  console.log(kleur.cyan('==============================\n'));
  console.log('Base: strat_iter207_d (30% profit) = +368%\n');

  const dataDir = 'data';
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && !f.includes('stock-data') && !f.includes('crypto'));
  
  const markets: any[] = [];
  const priceHistory: Record<string, { t: number; p: number }[]> = {};

  for (const file of files.slice(0, 300)) { // Limit for speed
    try {
      const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
      const data = JSON.parse(content);
      if (!Array.isArray(data) || data.length === 0) continue;
      const ticker = file.replace('.json', '');
      const tokenId = `stock_${ticker}`;
      markets.push({ ticker, condition_id: tokenId, description: `Stock ${ticker}`, tokens: [{ outcome: ticker, token_id: tokenId, price: 0.5, winner: false }] });
      priceHistory[tokenId] = data.map((d: any) => ({ t: new Date(d.date).getTime(), p: d.close }));
    } catch (e) {}
  }

  const data = { markets, priceHistory: new Map(Object.entries(priceHistory)) } as any;
  console.log(`Testing on ${markets.length} markets (300 for speed)\n`);

  const targets = [35, 40, 50, 60, 75];
  const results: any[] = [];

  for (const target of targets) {
    process.stdout.write(`Testing ${target}% profit target... `);
    
    // Create simple drop strategy with this profit target
    const strategyCode = `
      import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
      export class HighProfitStrategy implements Strategy {
        params = { drop: 0.02, stop: 0.12, profit: ${target / 100}, hold: 25, risk: 0.30 };
        closes: number[] = [];
        entryPrice: number = 0;
        entryBar: number = 0;
        barCount: number = 0;
        
        onInit() {}
        onNext(ctx: BacktestContext, bar: Bar) {
          this.closes.push(bar.close);
          this.barCount++;
          const pos = ctx.getPosition(bar.tokenId);
          if (pos && pos.size > 0) {
            if (bar.low <= this.entryPrice * (1 - this.params.stop) || 
                bar.high >= this.entryPrice * (1 + this.params.profit) ||
                this.barCount - this.entryBar >= this.params.hold) {
              ctx.close(bar.tokenId);
            }
            return;
          }
          if (this.closes.length < 2) return;
          const curr = this.closes[this.closes.length - 1];
          const prev = this.closes[this.closes.length - 2];
          if (prev - curr > 0 && (prev - curr) / prev > this.params.drop) {
            const cash = ctx.getCapital() * this.params.risk * 0.995;
            const size = cash / bar.close;
            if (size > 0 && cash <= ctx.getCapital()) {
              const result = ctx.buy(bar.tokenId, size);
              if (result.success) { this.entryPrice = bar.close; this.entryBar = this.barCount; }
            }
          }
        }
        onComplete() {}
      }
    `;
    
    // Use base strategy file and modify params
    const strategyPath = path.join(process.cwd(), 'src/strategies/strat_iter207_d.ts');
    delete require.cache[require.resolve(strategyPath)];
    const module = require(strategyPath);
    const StrategyClass = Object.values(module).find((exp: any) => typeof exp === 'function' && exp.name?.endsWith('Strategy')) as any;
    
    const strategy = new StrategyClass({ profit_target: target / 100 });
    const engine = new BacktestEngine(data, strategy, { initialCapital: 1000, feeRate: 0.001, slippage: 0 });
    
    try {
      const result = engine.run();
      const returnPct = ((result.totalReturn / 1000) - 1) * 100;
      const color = result.totalReturn > 4680 ? kleur.green : result.totalReturn > 1000 ? kleur.yellow : kleur.red;
      console.log(color(`$${result.totalReturn.toFixed(2)} (${returnPct.toFixed(0)}%) | ${result.totalTrades} trades`));
      
      results.push({ target, return: result.totalReturn, trades: result.totalTrades });
    } catch (e) {
      console.log(kleur.red('error'));
    }
  }

  console.log(kleur.cyan('\n=== RESULTS ===\n'));
  results.sort((a, b) => b.return - a.return);
  
  for (const r of results) {
    const color = r.return > 4680 ? kleur.green : r.return > 1000 ? kleur.yellow : kleur.red;
    const vsBase = ((r.return / 4680) - 1) * 100;
    console.log(color(`${r.target}% profit: $${r.return.toFixed(2)} (${vsBase >= 0 ? '+' : ''}${vsBase.toFixed(0)}% vs base)`));
  }
  
  const best = results[0];
  if (best && best.return > 4680) {
    console.log(kleur.green(`\n✅ ${best.target}% profit target beats 30%!`));
  }
}

main().catch(console.error);
