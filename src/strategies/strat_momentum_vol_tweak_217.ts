import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Momentum Vol Tweak 217
 * - Based on momentum_vol_212 (best balanced performer)
 * - Added EMA trend filter
 * - Tighter volatility confirmation
 */

export interface MomentumVolTweak217Params extends StrategyParams {
  momentum_period: number;
  momentum_threshold: number;
  volatility_period: number;
  volatility_multiplier: number;
  ema_period: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: MomentumVolTweak217Params = {
  momentum_period: 8,
  momentum_threshold: 0.036,
  volatility_period: 16,
  volatility_multiplier: 1.02,
  ema_period: 20,
  stop_loss: 0.043,
  trailing_stop: 0.034,
  risk_percent: 0.19,
};

function loadSavedParams(): Partial<MomentumVolTweak217Params> | null {
  const paramsPath = path.join(__dirname, 'strat_momentum_vol_tweak_217.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<MomentumVolTweak217Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof MomentumVolTweak217Params] = value;
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
  return Math.sqrt(sqDiffs / prices.length) / mean;
}

export class MomentumVolTweak217Strategy implements Strategy {
  params: MomentumVolTweak217Params;
  private priceHistory: Map<string, number[]> = new Map();
  private volatilityHistory: Map<string, number[]> = new Map();
  private emaValues: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<MomentumVolTweak217Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as MomentumVolTweak217Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private updateEMA(tokenId: string, price: number): number {
    const prevEMA = this.emaValues.get(tokenId);
    const k = 2 / (this.params.ema_period + 1);
    
    if (prevEMA === undefined) {
      this.emaValues.set(tokenId, price);
      return price;
    }
    
    const newEMA = price * k + prevEMA * (1 - k);
    this.emaValues.set(tokenId, newEMA);
    return newEMA;
  }

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
    const ema = this.updateEMA(bar.tokenId, bar.close);

    const maxPeriod = Math.max(this.params.momentum_period + 1, this.params.volatility_period, this.params.ema_period);
    if (history.length > maxPeriod + 10) history.shift();

    if (history.length >= this.params.volatility_period) {
      const currentVol = calcVolatility(history.slice(-this.params.volatility_period));
      volHistory.push(currentVol);
      if (volHistory.length > 20) volHistory.shift();
    }

    const momentum = this.getMomentum(bar.tokenId);
    const highVolatility = this.isVolatilityHigh(bar.tokenId);
    const trendUp = bar.close > ema;
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

        if (momentum < -this.params.momentum_threshold) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: momentum + volatility + trend filter
      if (momentum > this.params.momentum_threshold && highVolatility && trendUp) {
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
