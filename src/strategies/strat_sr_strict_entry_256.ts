import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SR Strict Entry 256
 * - Very strict entry conditions
 * - Multiple confirmations required
 * - Should result in very few but high quality trades
 */

export interface SRStrictEntry256Params extends StrategyParams {
  base_lookback: number;
  min_lookback: number;
  max_lookback: number;
  volatility_period: number;
  bounce_threshold: number;
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  trend_period: number;
  trend_threshold: number;
  momentum_period: number;
  momentum_threshold: number;
  min_bounce_bars: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: SRStrictEntry256Params = {
  base_lookback: 20,
  min_lookback: 8,
  max_lookback: 35,
  volatility_period: 10,
  bounce_threshold: 0.025,
  stoch_k_period: 14,
  stoch_d_period: 4,
  stoch_oversold: 20,
  stoch_overbought: 75,
  trend_period: 20,
  trend_threshold: 0.0,
  momentum_period: 3,
  momentum_threshold: 0.005,
  min_bounce_bars: 2,
  stop_loss: 0.07,
  trailing_stop: 0.05,
  risk_percent: 0.20,
};

function loadSavedParams(): Partial<SRStrictEntry256Params> | null {
  const paramsPath = path.join(__dirname, 'strat_sr_strict_entry_256.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<SRStrictEntry256Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof SRStrictEntry256Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

interface TokenData {
  prices: number[];
  highs: number[];
  lows: number[];
  kValues: number[];
  consecutiveBounces: number;
}

export class SRStrictEntry256Strategy implements Strategy {
  params: SRStrictEntry256Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<SRStrictEntry256Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as SRStrictEntry256Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, {
        prices: [],
        highs: [],
        lows: [],
        kValues: [],
        consecutiveBounces: 0,
      });
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
    if (data.prices.length < this.params.volatility_period) {
      return this.params.base_lookback;
    }
    
    const recentVol = this.calcVolatility(data.prices.slice(-this.params.volatility_period));
    const historicalVol = this.calcVolatility(data.prices.slice(-this.params.max_lookback));
    
    if (historicalVol === 0) return this.params.base_lookback;
    
    const volRatio = recentVol / historicalVol;
    let adaptiveLookback = Math.round(this.params.base_lookback / volRatio);
    
    return Math.max(this.params.min_lookback, Math.min(this.params.max_lookback, adaptiveLookback));
  }

  private getTrendStrength(prices: number[]): number {
    if (prices.length < this.params.trend_period) return 0;
    
    const recent = prices.slice(-this.params.trend_period);
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    return (last - first) / first;
  }

  private getMomentum(prices: number[]): number {
    if (prices.length < this.params.momentum_period + 1) return 0;
    
    const current = prices[prices.length - 1];
    const past = prices[prices.length - 1 - this.params.momentum_period];
    
    return (current - past) / past;
  }

  private findSupportLevels(data: TokenData, lookback: number): number[] {
    if (data.lows.length < lookback) return [];
    
    const recentLows = data.lows.slice(-lookback);
    const sorted = [...recentLows].sort((a, b) => a - b);
    return sorted.slice(0, 3);
  }

  private findResistanceLevel(data: TokenData, lookback: number): number | null {
    if (data.highs.length < lookback) return null;
    
    const recentHighs = data.highs.slice(-lookback);
    return Math.max(...recentHighs);
  }

  private getStochastic(data: TokenData): { k: number; d: number } | null {
    if (data.prices.length < this.params.stoch_k_period) return null;
    
    const slice = data.prices.slice(-this.params.stoch_k_period);
    const high = Math.max(...slice);
    const low = Math.min(...slice);
    const k = high === low ? 50 : ((data.prices[data.prices.length - 1] - low) / (high - low)) * 100;
    
    data.kValues.push(k);
    if (data.kValues.length > this.params.stoch_d_period) data.kValues.shift();
    
    if (data.kValues.length < this.params.stoch_d_period) return null;
    
    const d = data.kValues.reduce((a, b) => a + b, 0) / data.kValues.length;
    return { k, d };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const data = this.getOrCreateData(bar.tokenId);
    
    data.prices.push(bar.close);
    data.highs.push(bar.high);
    data.lows.push(bar.low);

    const maxPeriod = Math.max(this.params.max_lookback, this.params.trend_period) + 20;
    if (data.prices.length > maxPeriod) {
      data.prices.shift();
      data.highs.shift();
      data.lows.shift();
    }

    const prevPrice = data.prices.length > 1 ? data.prices[data.prices.length - 2] : bar.close;
    
    // Track consecutive bounces
    if (bar.close > prevPrice) {
      data.consecutiveBounces++;
    } else {
      data.consecutiveBounces = 0;
    }

    const stoch = this.getStochastic(data);
    const adaptiveLookback = this.getAdaptiveLookback(data);
    const trendStrength = this.getTrendStrength(data.prices);
    const momentum = this.getMomentum(data.prices);
    const supports = this.findSupportLevels(data, adaptiveLookback);
    const resistance = this.findResistanceLevel(data, adaptiveLookback);
    
    if (!stoch || supports.length === 0) return;

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

        if ((resistance !== null && bar.close >= resistance) || stoch.k >= this.params.stoch_overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      const nearSupport = supports.some(s => Math.abs(bar.close - s) / s < this.params.bounce_threshold);
      const stochOversold = stoch.k <= this.params.stoch_oversold && stoch.k > stoch.d;
      const trendOk = trendStrength >= this.params.trend_threshold;
      const momentumOk = momentum >= this.params.momentum_threshold;
      const multiBarBounce = data.consecutiveBounces >= this.params.min_bounce_bars;

      // Very strict: all conditions must be met
      if (nearSupport && multiBarBounce && stochOversold && trendOk && momentumOk) {
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
