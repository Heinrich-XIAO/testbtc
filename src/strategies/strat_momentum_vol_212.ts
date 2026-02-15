import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Momentum with Volatility Confirmation
 * - Enters when price momentum is strong AND volatility is above average
 * - Combines rate of change with volatility filter
 */

export interface MomentumVol212Params extends StrategyParams {
  momentum_period: number;
  momentum_threshold: number;
  volatility_period: number;
  volatility_multiplier: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: MomentumVol212Params = {
  momentum_period: 5,
  momentum_threshold: 0.02,
  volatility_period: 10,
  volatility_multiplier: 1.2,
  stop_loss: 0.05,
  trailing_stop: 0.03,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<MomentumVol212Params> | null {
  const paramsPath = path.join(__dirname, 'strat_momentum_vol_212.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<MomentumVol212Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof MomentumVol212Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

function calcVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const sqDiffs = prices.reduce((sum, p) => sum + (p - mean) * (p - mean), 0);
  return Math.sqrt(sqDiffs / prices.length) / mean; // Normalized volatility
}

export class MomentumVol212Strategy implements Strategy {
  params: MomentumVol212Params;
  private priceHistory: Map<string, number[]> = new Map();
  private volatilityHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<MomentumVol212Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as MomentumVol212Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getMomentum(tokenId: string): number {
    const history = this.priceHistory.get(tokenId) || [];
    if (history.length < this.params.momentum_period + 1) return 0;
    const current = history[history.length - 1];
    const past = history[history.length - 1 - this.params.momentum_period];
    return (current - past) / past;
  }

  private isVolatilityHigh(tokenId: string): boolean {
    const volHistory = this.volatilityHistory.get(tokenId) || [];
    if (volHistory.length < 2) return false;
    const currentVol = volHistory[volHistory.length - 1];
    const avgVol = volHistory.slice(0, -1).reduce((a, b) => a + b, 0) / (volHistory.length - 1);
    return currentVol > avgVol * this.params.volatility_multiplier;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.volatilityHistory.set(bar.tokenId, []);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const volHistory = this.volatilityHistory.get(bar.tokenId)!;

    history.push(bar.close);

    const maxPeriod = Math.max(this.params.momentum_period + 1, this.params.volatility_period);
    if (history.length > maxPeriod + 10) history.shift();

    // Calculate current volatility
    if (history.length >= this.params.volatility_period) {
      const currentVol = calcVolatility(history.slice(-this.params.volatility_period));
      volHistory.push(currentVol);
      if (volHistory.length > 20) volHistory.shift();
    }

    const momentum = this.getMomentum(bar.tokenId);
    const highVolatility = this.isVolatilityHigh(bar.tokenId);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const highest = this.highestPrice.get(bar.tokenId) ?? bar.close;

      if (entry) {
        // Update highest price
        if (bar.close > highest) {
          this.highestPrice.set(bar.tokenId, bar.close);
        }
        const newHighest = this.highestPrice.get(bar.tokenId)!;

        // Stop loss
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        // Trailing stop
        if (bar.close < newHighest * (1 - this.params.trailing_stop)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        // Exit on negative momentum
        if (momentum < -this.params.momentum_threshold) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: strong positive momentum with high volatility
      if (momentum > this.params.momentum_threshold && highVolatility) {
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
