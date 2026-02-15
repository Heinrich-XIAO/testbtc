import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SR Support Only 301
 * - Most minimal: Only support bounce requirement
 * - No stochastic, no trend, no momentum filters
 * - Goal: Baseline for how many trades support-only generates
 */

export interface SRSupportOnly301Params extends StrategyParams {
  base_lookback: number;
  min_lookback: number;
  max_lookback: number;
  volatility_period: number;
  bounce_threshold: number;
  min_bounce_bars: number;
  stop_loss: number;
  trailing_stop: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: SRSupportOnly301Params = {
  base_lookback: 18,
  min_lookback: 10,
  max_lookback: 36,
  volatility_period: 12,
  bounce_threshold: 0.03,
  min_bounce_bars: 2,
  stop_loss: 0.08,
  trailing_stop: 0.06,
  profit_target: 0.10,
  max_hold_bars: 25,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<SRSupportOnly301Params> | null {
  const paramsPath = path.join(__dirname, 'strat_sr_support_only_301.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<SRSupportOnly301Params> = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') params[key as keyof SRSupportOnly301Params] = value;
      }
    }
    return params;
  } catch { return null; }
}

interface TokenData {
  prices: number[];
  highs: number[];
  lows: number[];
  consecutiveBounces: number;
}

export class SRSupportOnly301Strategy implements Strategy {
  params: SRSupportOnly301Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();
  private barsHeld: Map<string, number> = new Map();

  constructor(params: Partial<SRSupportOnly301Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as SRSupportOnly301Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, { prices: [], highs: [], lows: [], consecutiveBounces: 0 });
    }
    return this.tokenData.get(tokenId)!;
  }

  private calcVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const sqDiffs = prices.reduce((sum, p) => sum + (p - mean) * (p - mean), 0);
    return Math.sqrt(sqDiffs / prices.length) / mean;
  }

  private getAdaptiveLookback(data: TokenData): number {
    if (data.prices.length < this.params.volatility_period) return this.params.base_lookback;
    const recentVol = this.calcVolatility(data.prices.slice(-this.params.volatility_period));
    const historicalVol = this.calcVolatility(data.prices.slice(-this.params.max_lookback));
    if (historicalVol === 0) return this.params.base_lookback;
    const volRatio = recentVol / historicalVol;
    let adaptiveLookback = Math.round(this.params.base_lookback / volRatio);
    return Math.max(this.params.min_lookback, Math.min(this.params.max_lookback, adaptiveLookback));
  }

  private findSupportLevels(data: TokenData, lookback: number): number[] {
    if (data.lows.length < lookback) return [];
    const recentLows = data.lows.slice(-lookback);
    const sorted = [...recentLows].sort((a, b) => a - b);
    return sorted.slice(0, 3);
  }

  private findResistanceLevel(data: TokenData, lookback: number): number | null {
    if (data.highs.length < lookback) return null;
    return Math.max(...data.highs.slice(-lookback));
  }

  private closePosition(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.highestPrice.delete(tokenId);
    this.barsHeld.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const data = this.getOrCreateData(bar.tokenId);
    data.prices.push(bar.close);
    data.highs.push(bar.high);
    data.lows.push(bar.low);

    const maxPeriod = this.params.max_lookback + 20;
    if (data.prices.length > maxPeriod) {
      data.prices.shift();
      data.highs.shift();
      data.lows.shift();
    }

    const prevPrice = data.prices.length > 1 ? data.prices[data.prices.length - 2] : bar.close;
    if (bar.close > prevPrice) data.consecutiveBounces++;
    else data.consecutiveBounces = 0;

    const adaptiveLookback = this.getAdaptiveLookback(data);
    const supports = this.findSupportLevels(data, adaptiveLookback);
    const resistance = this.findResistanceLevel(data, adaptiveLookback);
    
    if (supports.length === 0) return;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const highest = this.highestPrice.get(bar.tokenId) ?? bar.close;
      const bars = this.barsHeld.get(bar.tokenId) ?? 0;
      this.barsHeld.set(bar.tokenId, bars + 1);
      
      if (entry) {
        if (bar.close > highest) this.highestPrice.set(bar.tokenId, bar.close);
        const newHighest = this.highestPrice.get(bar.tokenId)!;

        if (bar.close < entry * (1 - this.params.stop_loss)) { this.closePosition(ctx, bar.tokenId); return; }
        if (bar.close < newHighest * (1 - this.params.trailing_stop)) { this.closePosition(ctx, bar.tokenId); return; }
        if (bar.close >= entry * (1 + this.params.profit_target)) { this.closePosition(ctx, bar.tokenId); return; }
        if (bars >= this.params.max_hold_bars) { this.closePosition(ctx, bar.tokenId); return; }
        if (resistance !== null && bar.close >= resistance) {
          this.closePosition(ctx, bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // SUPPORT ONLY - No stochastic, no trend, no momentum
      const nearSupport = supports.some(s => Math.abs(bar.close - s) / s < this.params.bounce_threshold);
      const multiBarBounce = data.consecutiveBounces >= this.params.min_bounce_bars;

      if (nearSupport && multiBarBounce) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
            this.barsHeld.set(bar.tokenId, 0);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
