import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Slow triple MA alignment
 */

export interface TriMASlowStrategyParams extends StrategyParams {
  fast_period: number;
  mid_period: number;
  slow_period: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: TriMASlowStrategyParams = {
  fast_period: 5,
  mid_period: 12,
  slow_period: 20,
  stop_loss: 0.08,
  trailing_stop: 0.06,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<TriMASlowStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_tri_ma_slow_37.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<TriMASlowStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof TriMASlowStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class TriMASlowStrategy implements Strategy {
  params: TriMASlowStrategyParams;
  private fastMAs: Map<string, SimpleMovingAverage> = new Map();
  private midMAs: Map<string, SimpleMovingAverage> = new Map();
  private slowMAs: Map<string, SimpleMovingAverage> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<TriMASlowStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    const sorted = [this.params.fast_period, this.params.mid_period, this.params.slow_period].sort((a, b) => a - b);
    this.params.fast_period = Math.max(2, Math.floor(sorted[0]));
    this.params.mid_period = Math.max(3, Math.floor(sorted[1]));
    this.params.slow_period = Math.max(4, Math.floor(sorted[2]));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.fastMAs.has(bar.tokenId)) {
      this.fastMAs.set(bar.tokenId, new SimpleMovingAverage(this.params.fast_period));
      this.midMAs.set(bar.tokenId, new SimpleMovingAverage(this.params.mid_period));
      this.slowMAs.set(bar.tokenId, new SimpleMovingAverage(this.params.slow_period));
    }
    const fast = this.fastMAs.get(bar.tokenId)!;
    const mid = this.midMAs.get(bar.tokenId)!;
    const slow = this.slowMAs.get(bar.tokenId)!;
    fast.update(bar.close);
    mid.update(bar.close);
    slow.update(bar.close);

    const fv = fast.get(0), mv = mid.get(0), sv = slow.get(0);
    if (fv === undefined || mv === undefined || sv === undefined) return;

    const bullish = fv > mv && mv > sv;
    const bearish = fv < mv && mv < sv;
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
        if (bearish) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (bullish) {
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

