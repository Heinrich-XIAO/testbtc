import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Fast EMA crossover with tight stops
 */

export interface EMAFastCrossStrategyParams extends StrategyParams {
  fast_period: number;
  slow_period: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: EMAFastCrossStrategyParams = {
  fast_period: 3,
  slow_period: 8,
  stop_loss: 0.04,
  trailing_stop: 0.03,
  risk_percent: 0.1,
};

function loadSavedParams(): Partial<EMAFastCrossStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_ema_fast_11.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<EMAFastCrossStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof EMAFastCrossStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


class ExponentialMA {
  private period: number;
  private multiplier: number;
  private value: number | undefined;
  private values: number[] = [];
  
  constructor(period: number) {
    this.period = period;
    this.multiplier = 2 / (period + 1);
  }
  
  update(price: number): void {
    if (this.value === undefined) {
      this.values.push(price);
      if (this.values.length >= this.period) {
        this.value = this.values.reduce((a, b) => a + b, 0) / this.period;
      }
    } else {
      this.value = (price - this.value) * this.multiplier + this.value;
    }
  }
  
  get(): number | undefined { return this.value; }
}

export class EMAFastCrossStrategy implements Strategy {
  params: EMAFastCrossStrategyParams;
  private fastEMAs: Map<string, ExponentialMA> = new Map();
  private slowEMAs: Map<string, ExponentialMA> = new Map();
  private prevDiff: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<EMAFastCrossStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };
    let fast = Math.max(2, Math.floor(mergedParams.fast_period));
    let slow = Math.max(3, Math.floor(mergedParams.slow_period));
    if (fast >= slow) [fast, slow] = [slow, fast];
    this.params = { ...mergedParams, fast_period: fast, slow_period: slow };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.fastEMAs.has(bar.tokenId)) {
      this.fastEMAs.set(bar.tokenId, new ExponentialMA(this.params.fast_period));
      this.slowEMAs.set(bar.tokenId, new ExponentialMA(this.params.slow_period));
    }
    const fastEMA = this.fastEMAs.get(bar.tokenId)!;
    const slowEMA = this.slowEMAs.get(bar.tokenId)!;
    fastEMA.update(bar.close);
    slowEMA.update(bar.close);

    const fastVal = fastEMA.get();
    const slowVal = slowEMA.get();
    if (fastVal === undefined || slowVal === undefined) return;

    const diff = fastVal - slowVal;
    const prev = this.prevDiff.get(bar.tokenId);
    this.prevDiff.set(bar.tokenId, diff);

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry !== undefined) {
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
        if (prev !== undefined && prev >= 0 && diff < 0) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (prev !== undefined && prev <= 0 && diff > 0) {
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

