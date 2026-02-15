import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Mean Reversion with Momentum Filter 224
 * - Buys oversold conditions
 * - But only when short-term momentum turns positive
 */

export interface MeanRevMomentum224Params extends StrategyParams {
  lookback: number;
  oversold_percentile: number;
  momentum_period: number;
  momentum_threshold: number;
  stop_loss: number;
  take_profit: number;
  risk_percent: number;
}

const defaultParams: MeanRevMomentum224Params = {
  lookback: 20,
  oversold_percentile: 20,
  momentum_period: 3,
  momentum_threshold: 0.005,
  stop_loss: 0.05,
  take_profit: 0.08,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<MeanRevMomentum224Params> | null {
  const paramsPath = path.join(__dirname, 'strat_mean_rev_momentum_224.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<MeanRevMomentum224Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof MeanRevMomentum224Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class MeanRevMomentum224Strategy implements Strategy {
  params: MeanRevMomentum224Params;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<MeanRevMomentum224Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as MeanRevMomentum224Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getPercentile(history: number[], current: number): number {
    if (history.length < 2) return 50;
    const sorted = [...history].sort((a, b) => a - b);
    let count = 0;
    for (const v of sorted) {
      if (v < current) count++;
    }
    return (count / sorted.length) * 100;
  }

  private getMomentum(history: number[]): number {
    if (history.length < this.params.momentum_period + 1) return 0;
    const current = history[history.length - 1];
    const past = history[history.length - 1 - this.params.momentum_period];
    return (current - past) / past;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);

    const maxPeriod = Math.max(this.params.lookback, this.params.momentum_period + 1) + 5;
    if (history.length > maxPeriod) history.shift();

    const percentile = this.getPercentile(history.slice(0, -1), bar.close);
    const momentum = this.getMomentum(history);

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      
      if (entry) {
        // Stop loss
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }

        // Take profit
        if (bar.close > entry * (1 + this.params.take_profit)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }

        // Exit when overbought
        if (percentile > 80) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: oversold with positive momentum (bottom reversal)
      if (percentile <= this.params.oversold_percentile && momentum > this.params.momentum_threshold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
