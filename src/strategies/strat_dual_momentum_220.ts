import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dual Momentum Strategy 220
 * - Combines price momentum with volatility-adjusted momentum
 * - Requires both types of momentum to align
 */

export interface DualMomentum220Params extends StrategyParams {
  fast_period: number;
  slow_period: number;
  volatility_period: number;
  momentum_threshold: number;
  vol_adj_factor: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: DualMomentum220Params = {
  fast_period: 5,
  slow_period: 15,
  volatility_period: 10,
  momentum_threshold: 0.02,
  vol_adj_factor: 0.5,
  stop_loss: 0.05,
  trailing_stop: 0.03,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<DualMomentum220Params> | null {
  const paramsPath = path.join(__dirname, 'strat_dual_momentum_220.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<DualMomentum220Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof DualMomentum220Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class DualMomentum220Strategy implements Strategy {
  params: DualMomentum220Params;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<DualMomentum220Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as DualMomentum220Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getFastMomentum(history: number[]): number {
    if (history.length < this.params.fast_period + 1) return 0;
    const current = history[history.length - 1];
    const past = history[history.length - 1 - this.params.fast_period];
    return (current - past) / past;
  }

  private getSlowMomentum(history: number[]): number {
    if (history.length < this.params.slow_period + 1) return 0;
    const current = history[history.length - 1];
    const past = history[history.length - 1 - this.params.slow_period];
    return (current - past) / past;
  }

  private getVolatility(history: number[]): number {
    if (history.length < this.params.volatility_period) return 1;
    const slice = history.slice(-this.params.volatility_period);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((sum, p) => sum + (p - mean) * (p - mean), 0) / slice.length;
    return Math.sqrt(variance) / mean;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);

    const maxPeriod = Math.max(this.params.slow_period + 1, this.params.volatility_period) + 5;
    if (history.length > maxPeriod) history.shift();

    const fastMom = this.getFastMomentum(history);
    const slowMom = this.getSlowMomentum(history);
    const vol = this.getVolatility(history);
    
    // Volatility-adjusted momentum
    const volAdjMom = fastMom / (1 + vol * this.params.vol_adj_factor);

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

        // Exit on negative momentum
        if (fastMom < -this.params.momentum_threshold) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: both momentum signals positive
      const threshold = this.params.momentum_threshold;
      if (fastMom > threshold && slowMom > 0 && volAdjMom > threshold * 0.5) {
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
