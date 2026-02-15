import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Slow trend strength filter
 */

export interface TStrSlowStrategyParams extends StrategyParams {
  lookback: number;
  entry_strength: number;
  exit_strength: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: TStrSlowStrategyParams = {
  lookback: 12,
  entry_strength: 0.65,
  exit_strength: 0.35,
  stop_loss: 0.08,
  trailing_stop: 0.06,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<TStrSlowStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_tstr_slow_45.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<TStrSlowStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof TStrSlowStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class TStrSlowStrategy implements Strategy {
  params: TStrSlowStrategyParams;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<TStrSlowStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  private trendStrength(history: number[]): number {
    // Percentage of bars that were positive
    let ups = 0;
    for (let i = 1; i < history.length; i++) {
      if (history[i] > history[i - 1]) ups++;
    }
    return ups / (history.length - 1);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    const period = Math.max(3, Math.floor(this.params.lookback));
    if (history.length > period + 2) history.shift();

    if (history.length < period) return;

    const strength = this.trendStrength(history);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (strength < this.params.exit_strength) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (strength >= this.params.entry_strength) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}

