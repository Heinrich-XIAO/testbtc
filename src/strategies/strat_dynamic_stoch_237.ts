import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dynamic Stoch 237
 * - Dynamic stochastic thresholds based on volatility
 * - Higher volatility = wider oversold/overbought bands
 */

export interface DynamicStoch237Params extends StrategyParams {
  lookback: number;
  bounce_threshold: number;
  stoch_k_period: number;
  stoch_d_period: number;
  base_oversold: number;
  base_overbought: number;
  vol_period: number;
  vol_scale: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: DynamicStoch237Params = {
  lookback: 20,
  bounce_threshold: 0.035,
  stoch_k_period: 14,
  stoch_d_period: 4,
  base_oversold: 25,
  base_overbought: 75,
  vol_period: 12,
  vol_scale: 100,
  stop_loss: 0.08,
  trailing_stop: 0.05,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<DynamicStoch237Params> | null {
  const paramsPath = path.join(__dirname, 'strat_dynamic_stoch_237.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<DynamicStoch237Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof DynamicStoch237Params] = value;
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
}

export class DynamicStoch237Strategy implements Strategy {
  params: DynamicStoch237Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<DynamicStoch237Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as DynamicStoch237Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, {
        prices: [],
        highs: [],
        lows: [],
        kValues: [],
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

  private getDynamicThresholds(data: TokenData): { oversold: number; overbought: number } {
    if (data.prices.length < this.params.vol_period) {
      return { oversold: this.params.base_oversold, overbought: this.params.base_overbought };
    }
    
    const vol = this.calcVolatility(data.prices.slice(-this.params.vol_period));
    const adjustment = vol * this.params.vol_scale;
    
    // Higher volatility = wider bands (lower oversold, higher overbought)
    const oversold = Math.max(10, this.params.base_oversold - adjustment);
    const overbought = Math.min(90, this.params.base_overbought + adjustment);
    
    return { oversold, overbought };
  }

  private findSupportLevels(data: TokenData): number[] {
    if (data.lows.length < this.params.lookback) return [];
    
    const recentLows = data.lows.slice(-this.params.lookback);
    const sorted = [...recentLows].sort((a, b) => a - b);
    return sorted.slice(0, 3);
  }

  private findResistanceLevel(data: TokenData): number | null {
    if (data.highs.length < this.params.lookback) return null;
    
    const recentHighs = data.highs.slice(-this.params.lookback);
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

    const maxPeriod = Math.max(this.params.lookback, this.params.vol_period) + 20;
    if (data.prices.length > maxPeriod) {
      data.prices.shift();
      data.highs.shift();
      data.lows.shift();
    }

    const stoch = this.getStochastic(data);
    const supports = this.findSupportLevels(data);
    const resistance = this.findResistanceLevel(data);
    const { oversold, overbought } = this.getDynamicThresholds(data);
    
    if (!stoch || supports.length === 0) return;

    const position = ctx.getPosition(bar.tokenId);
    const prevPrice = data.prices.length > 1 ? data.prices[data.prices.length - 2] : bar.close;

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

        if ((resistance !== null && bar.close >= resistance) || stoch.k >= overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      const nearSupport = supports.some(s => Math.abs(bar.close - s) / s < this.params.bounce_threshold);
      const bouncing = bar.close > prevPrice;
      const stochOversold = stoch.k <= oversold && stoch.k > stoch.d;

      if (nearSupport && bouncing && stochOversold) {
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
