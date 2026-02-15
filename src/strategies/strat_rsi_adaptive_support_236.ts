import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * RSI Adaptive Support 236
 * - RSI with adaptive support level detection
 * - Uses RSI oversold + support bounce
 */

export interface RSIAdaptiveSupport236Params extends StrategyParams {
  rsi_period: number;
  rsi_oversold: number;
  rsi_overbought: number;
  base_lookback: number;
  min_lookback: number;
  max_lookback: number;
  volatility_period: number;
  bounce_threshold: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: RSIAdaptiveSupport236Params = {
  rsi_period: 14,
  rsi_oversold: 30,
  rsi_overbought: 70,
  base_lookback: 20,
  min_lookback: 8,
  max_lookback: 35,
  volatility_period: 10,
  bounce_threshold: 0.035,
  stop_loss: 0.08,
  trailing_stop: 0.05,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<RSIAdaptiveSupport236Params> | null {
  const paramsPath = path.join(__dirname, 'strat_rsi_adaptive_support_236.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<RSIAdaptiveSupport236Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof RSIAdaptiveSupport236Params] = value;
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
}

export class RSIAdaptiveSupport236Strategy implements Strategy {
  params: RSIAdaptiveSupport236Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<RSIAdaptiveSupport236Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as RSIAdaptiveSupport236Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, { prices: [], highs: [], lows: [] });
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

  private calculateRSI(data: TokenData): number | null {
    if (data.prices.length < this.params.rsi_period + 1) return null;
    
    const prices = data.prices.slice(-this.params.rsi_period - 1);
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    if (losses === 0) return 100;
    if (gains === 0) return 0;
    
    const rs = (gains / this.params.rsi_period) / (losses / this.params.rsi_period);
    return 100 - (100 / (1 + rs));
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

    const rsi = this.calculateRSI(data);
    const adaptiveLookback = this.getAdaptiveLookback(data);
    const supports = this.findSupportLevels(data, adaptiveLookback);
    const resistance = this.findResistanceLevel(data, adaptiveLookback);
    
    if (rsi === null || supports.length === 0) return;

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

        if ((resistance !== null && bar.close >= resistance) || rsi >= this.params.rsi_overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      const nearSupport = supports.some(s => Math.abs(bar.close - s) / s < this.params.bounce_threshold);
      const bouncing = bar.close > prevPrice;
      const rsiOversold = rsi <= this.params.rsi_oversold;

      if (nearSupport && bouncing && rsiOversold) {
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
