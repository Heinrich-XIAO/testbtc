import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Rate of Change with Adaptive Thresholds
 * - Adjusts entry thresholds based on recent price volatility
 * - More aggressive in low volatility, conservative in high volatility
 */

export interface RocAdaptive213Params extends StrategyParams {
  roc_period: number;
  volatility_period: number;
  base_threshold: number;
  threshold_scale: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: RocAdaptive213Params = {
  roc_period: 5,
  volatility_period: 14,
  base_threshold: 0.015,
  threshold_scale: 2.0,
  stop_loss: 0.05,
  trailing_stop: 0.03,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<RocAdaptive213Params> | null {
  const paramsPath = path.join(__dirname, 'strat_roc_adaptive_213.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<RocAdaptive213Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof RocAdaptive213Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

function calcStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0);
  return Math.sqrt(sqDiffs / values.length);
}

export class RocAdaptive213Strategy implements Strategy {
  params: RocAdaptive213Params;
  private priceHistory: Map<string, number[]> = new Map();
  private rocHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<RocAdaptive213Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as RocAdaptive213Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getRoc(tokenId: string): number {
    const history = this.priceHistory.get(tokenId) || [];
    if (history.length < this.params.roc_period + 1) return 0;
    const current = history[history.length - 1];
    const past = history[history.length - 1 - this.params.roc_period];
    return (current - past) / past;
  }

  private getAdaptiveThreshold(tokenId: string): number {
    const rocHistory = this.rocHistory.get(tokenId) || [];
    if (rocHistory.length < this.params.volatility_period) {
      return this.params.base_threshold;
    }

    const recentRoc = rocHistory.slice(-this.params.volatility_period);
    const rocStdDev = calcStdDev(recentRoc);
    
    // Higher volatility = higher threshold (more conservative)
    return this.params.base_threshold + rocStdDev * this.params.threshold_scale;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.rocHistory.set(bar.tokenId, []);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const rocHist = this.rocHistory.get(bar.tokenId)!;

    history.push(bar.close);
    const maxPeriod = Math.max(this.params.roc_period + 1, this.params.volatility_period + 10);
    if (history.length > maxPeriod) history.shift();

    const roc = this.getRoc(bar.tokenId);
    rocHist.push(roc);
    if (rocHist.length > this.params.volatility_period + 10) rocHist.shift();

    const threshold = this.getAdaptiveThreshold(bar.tokenId);
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
          this.clearPosition(bar.tokenId);
          return;
        }

        if (bar.close < newHighest * (1 - this.params.trailing_stop)) {
          ctx.close(bar.tokenId);
          this.clearPosition(bar.tokenId);
          return;
        }

        // Exit on negative ROC
        if (roc < -threshold) {
          ctx.close(bar.tokenId);
          this.clearPosition(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: ROC exceeds adaptive threshold
      if (roc > threshold) {
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

  private clearPosition(tokenId: string): void {
    this.entryPrice.delete(tokenId);
    this.highestPrice.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
}
