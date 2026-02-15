import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Short-term Price Change Strategy
 * 
 * Designed for sparse data (20-30 data points per token).
 * Uses simple price change over short lookback instead of moving averages.
 * Uses a trailing stop exit instead of exiting on any negative momentum.
 * 
 * Parameters:
 * - lookback: Number of bars to measure price change (2-5)
 * - entry_threshold: Minimum price change % to enter (0.01-0.10)
 * - trailing_stop_pct: Exit when price drops this % from highest since entry
 * - minimum_hold: Minimum bars to hold before considering exit
 * - risk_percent: Position size as % of capital
 */

export interface ShortTermParams extends StrategyParams {
  lookback: number;
  entry_threshold: number;
  trailing_stop_pct: number;
  minimum_hold: number;
  risk_percent: number;
}

const defaultParams: ShortTermParams = {
  lookback: 3,
  entry_threshold: 0.05,
  trailing_stop_pct: 0.05,
  minimum_hold: 3,
  risk_percent: 0.1,
};

function loadSavedParams(): Partial<ShortTermParams> | null {
  const paramsPath = path.join(__dirname, 'strat_momentum_07.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<ShortTermParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof ShortTermParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class ShortTermStrategy implements Strategy {
  params: ShortTermParams;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestSinceEntry: Map<string, number> = new Map();
  private barsHeld: Map<string, number> = new Map();

  constructor(params: Partial<ShortTermParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    this.params = {
      lookback: Math.max(2, Math.floor(mergedParams.lookback)),
      entry_threshold: mergedParams.entry_threshold,
      trailing_stop_pct: mergedParams.trailing_stop_pct,
      minimum_hold: Math.max(0, Math.floor(mergedParams.minimum_hold)),
      risk_percent: mergedParams.risk_percent,
    };
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`ShortTermStrategy initialized:`);
    console.log(`  Lookback: ${this.params.lookback} bars`);
    console.log(`  Entry threshold: ${(this.params.entry_threshold * 100).toFixed(1)}%`);
    console.log(`  Trailing stop: ${(this.params.trailing_stop_pct * 100).toFixed(1)}%`);
    console.log(`  Minimum hold: ${this.params.minimum_hold} bars`);
    console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
  }

  private getPriceChange(tokenId: string): number | undefined {
    const history = this.priceHistory.get(tokenId);
    if (!history || history.length < this.params.lookback + 1) {
      return undefined;
    }

    const current = history[history.length - 1];
    const past = history[history.length - 1 - this.params.lookback];
    
    if (past <= 0) return undefined;
    return (current - past) / past;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    // Update price history
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
    }
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);

    // Keep history bounded
    const maxHistory = this.params.lookback + 5;
    if (history.length > maxHistory) {
      history.shift();
    }

    const priceChange = this.getPriceChange(bar.tokenId);
    if (priceChange === undefined) {
      return;
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      
      if (entry) {
        // Update highest price since entry
        const prevHighest = this.highestSinceEntry.get(bar.tokenId) ?? entry;
        const highest = Math.max(prevHighest, bar.close);
        this.highestSinceEntry.set(bar.tokenId, highest);

        // Increment bars held
        const held = (this.barsHeld.get(bar.tokenId) ?? 0) + 1;
        this.barsHeld.set(bar.tokenId, held);

        // Only consider exits after minimum hold period
        if (held >= this.params.minimum_hold) {
          // Trailing stop: exit when price drops trailing_stop_pct from highest
          const drawdownFromHighest = (highest - bar.close) / highest;
          if (drawdownFromHighest >= this.params.trailing_stop_pct) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] TRAILING STOP ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} highest=${highest.toFixed(4)} drawdown=${(drawdownFromHighest * 100).toFixed(1)}%`);
            ctx.close(bar.tokenId);
            this.entryPrice.delete(bar.tokenId);
            this.highestSinceEntry.delete(bar.tokenId);
            this.barsHeld.delete(bar.tokenId);
            return;
          }
        }
      }
    } else {
      // Entry: buy when price has moved up by threshold amount
      if (priceChange >= this.params.entry_threshold) {
        // Don't buy near extremes (prediction market specific)
        if (bar.close > 0.1 && bar.close < 0.9) {
          const cash = ctx.getCapital() * this.params.risk_percent;
          const size = cash / bar.close;

          if (size > 0 && cash <= ctx.getCapital()) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... change=${(priceChange * 100).toFixed(1)}% price=${bar.close.toFixed(4)}`);
            
            const result = ctx.buy(bar.tokenId, size);
            if (result.success) {
              this.entryPrice.set(bar.tokenId, bar.close);
              this.highestSinceEntry.set(bar.tokenId, bar.close);
              this.barsHeld.set(bar.tokenId, 0);
            }
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {
    console.log('\nStrategy completed.');
  }
}
