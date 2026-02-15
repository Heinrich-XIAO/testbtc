import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Multi Timeframe SR 240
 * - Multi-timeframe support detection
 * - Combines short and long-term support levels
 */

export interface MultiTimeframeSR240Params extends StrategyParams {
  short_lookback: number;
  long_lookback: number;
  bounce_threshold: number;
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: MultiTimeframeSR240Params = {
  short_lookback: 10,
  long_lookback: 30,
  bounce_threshold: 0.035,
  stoch_k_period: 14,
  stoch_d_period: 4,
  stoch_oversold: 25,
  stoch_overbought: 65,
  stop_loss: 0.08,
  trailing_stop: 0.05,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<MultiTimeframeSR240Params> | null {
  const paramsPath = path.join(__dirname, 'strat_multi_timeframe_sr_240.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<MultiTimeframeSR240Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof MultiTimeframeSR240Params] = value;
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

export class MultiTimeframeSR240Strategy implements Strategy {
  params: MultiTimeframeSR240Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<MultiTimeframeSR240Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as MultiTimeframeSR240Params;
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

  private findShortTermSupport(data: TokenData): number[] {
    if (data.lows.length < this.params.short_lookback) return [];
    
    const recentLows = data.lows.slice(-this.params.short_lookback);
    const sorted = [...recentLows].sort((a, b) => a - b);
    return sorted.slice(0, 2);
  }

  private findLongTermSupport(data: TokenData): number[] {
    if (data.lows.length < this.params.long_lookback) return [];
    
    const recentLows = data.lows.slice(-this.params.long_lookback);
    const sorted = [...recentLows].sort((a, b) => a - b);
    return sorted.slice(0, 2);
  }

  private findResistanceLevel(data: TokenData): number | null {
    if (data.highs.length < this.params.long_lookback) return null;
    
    const recentHighs = data.highs.slice(-this.params.long_lookback);
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

  private isNearSupport(price: number, shortSupports: number[], longSupports: number[]): boolean {
    const threshold = this.params.bounce_threshold;
    
    // Check if near any short-term support
    const nearShort = shortSupports.some(s => Math.abs(price - s) / s < threshold);
    
    // Check if near any long-term support
    const nearLong = longSupports.some(s => Math.abs(price - s) / s < threshold);
    
    // Prefer confluence - both short and long-term support nearby
    const shortLongConfluence = shortSupports.some(ss => 
      longSupports.some(ls => Math.abs(ss - ls) / ls < threshold * 2)
    );
    
    // Enter if near short-term support AND (near long-term OR confluence exists)
    return nearShort && (nearLong || shortLongConfluence);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const data = this.getOrCreateData(bar.tokenId);
    
    data.prices.push(bar.close);
    data.highs.push(bar.high);
    data.lows.push(bar.low);

    const maxPeriod = this.params.long_lookback + 20;
    if (data.prices.length > maxPeriod) {
      data.prices.shift();
      data.highs.shift();
      data.lows.shift();
    }

    const stoch = this.getStochastic(data);
    const shortSupports = this.findShortTermSupport(data);
    const longSupports = this.findLongTermSupport(data);
    const resistance = this.findResistanceLevel(data);
    
    if (!stoch || shortSupports.length === 0) return;

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

        if ((resistance !== null && bar.close >= resistance) || stoch.k >= this.params.stoch_overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      const nearSupport = this.isNearSupport(bar.close, shortSupports, longSupports);
      const bouncing = bar.close > prevPrice;
      const stochOversold = stoch.k <= this.params.stoch_oversold && stoch.k > stoch.d;

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
