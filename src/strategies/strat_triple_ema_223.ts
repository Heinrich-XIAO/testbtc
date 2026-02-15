import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Triple EMA Strategy 223
 * - Uses three EMAs of different periods
 * - Enters when all three align in uptrend
 */

export interface TripleEMA223Params extends StrategyParams {
  fast_period: number;
  medium_period: number;
  slow_period: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: TripleEMA223Params = {
  fast_period: 5,
  medium_period: 12,
  slow_period: 26,
  stop_loss: 0.05,
  trailing_stop: 0.03,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<TripleEMA223Params> | null {
  const paramsPath = path.join(__dirname, 'strat_triple_ema_223.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<TripleEMA223Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof TripleEMA223Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

interface EMAData {
  fast: number | null;
  medium: number | null;
  slow: number | null;
}

export class TripleEMA223Strategy implements Strategy {
  params: TripleEMA223Params;
  private emaData: Map<string, EMAData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<TripleEMA223Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as TripleEMA223Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateEMA(tokenId: string): EMAData {
    if (!this.emaData.has(tokenId)) {
      this.emaData.set(tokenId, { fast: null, medium: null, slow: null });
    }
    return this.emaData.get(tokenId)!;
  }

  private updateEMA(current: number | null, price: number, period: number): number {
    const k = 2 / (period + 1);
    if (current === null) return price;
    return price * k + current * (1 - k);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const ema = this.getOrCreateEMA(bar.tokenId);
    
    ema.fast = this.updateEMA(ema.fast, bar.close, this.params.fast_period);
    ema.medium = this.updateEMA(ema.medium, bar.close, this.params.medium_period);
    ema.slow = this.updateEMA(ema.slow, bar.close, this.params.slow_period);

    if (ema.fast === null || ema.medium === null || ema.slow === null) return;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const highest = this.highestPrice.get(bar.tokenId) ?? bar.close;

      if (entry) {
        if (bar.close > highest) {
          this.highestPrice.set(bar.tokenId, bar.close);
        }
        const newHighest = this.highestPrice.get(bar.tokenId)!;

        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        if (bar.close < newHighest * (1 - this.params.trailing_stop)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        // Exit when fast crosses below medium
        if (ema.fast < ema.medium) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: fast > medium > slow (all aligned uptrend)
      if (ema.fast > ema.medium && ema.medium > ema.slow && bar.close > ema.fast) {
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
