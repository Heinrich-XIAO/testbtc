import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Slow price acceleration for trend shifts
 */

export interface AccelSlowStrategyParams extends StrategyParams {
  lookback: number;
  entry_threshold: number;
  exit_threshold: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: AccelSlowStrategyParams = {
  lookback: 8,
  entry_threshold: 0.003,
  exit_threshold: 0.002,
  stop_loss: 0.08,
  trailing_stop: 0.06,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<AccelSlowStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_accel_slow_25.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<AccelSlowStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof AccelSlowStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class AccelSlowStrategy implements Strategy {
  params: AccelSlowStrategyParams;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<AccelSlowStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.lookback = Math.max(3, Math.floor(this.params.lookback));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > this.params.lookback + 2) history.shift();

    if (history.length < this.params.lookback + 1) return;

    // Compute velocity (first derivative) and acceleration (second derivative)
    const n = history.length;
    const vel1 = history[n - 1] - history[n - 2];
    const vel0 = history[n - 2] - history[n - 3];
    const accel = vel1 - vel0;
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
        if (accel < -this.params.exit_threshold && vel1 < 0) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (accel > this.params.entry_threshold && vel1 > 0) {
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

