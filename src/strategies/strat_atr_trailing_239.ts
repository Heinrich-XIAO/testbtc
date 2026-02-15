import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ATR Trailing 239
 * - ATR-based adaptive trailing stop with SR
 * - Trailing stop adjusts based on recent price range
 */

export interface ATRTrailing239Params extends StrategyParams {
  lookback: number;
  bounce_threshold: number;
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  atr_period: number;
  atr_multiplier: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: ATRTrailing239Params = {
  lookback: 20,
  bounce_threshold: 0.035,
  stoch_k_period: 14,
  stoch_d_period: 4,
  stoch_oversold: 25,
  stoch_overbought: 65,
  atr_period: 14,
  atr_multiplier: 2.0,
  stop_loss: 0.10,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<ATRTrailing239Params> | null {
  const paramsPath = path.join(__dirname, 'strat_atr_trailing_239.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<ATRTrailing239Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof ATRTrailing239Params] = value;
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
  trueRanges: number[];
}

export class ATRTrailing239Strategy implements Strategy {
  params: ATRTrailing239Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<ATRTrailing239Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as ATRTrailing239Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, {
        prices: [],
        highs: [],
        lows: [],
        kValues: [],
        trueRanges: [],
      });
    }
    return this.tokenData.get(tokenId)!;
  }

  private calculateATR(data: TokenData): number | null {
    if (data.trueRanges.length < this.params.atr_period) return null;
    
    const recentTR = data.trueRanges.slice(-this.params.atr_period);
    return recentTR.reduce((a, b) => a + b, 0) / recentTR.length;
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
    
    // Calculate true range
    if (data.prices.length > 0) {
      const prevClose = data.prices[data.prices.length - 1];
      const tr = Math.max(
        bar.high - bar.low,
        Math.abs(bar.high - prevClose),
        Math.abs(bar.low - prevClose)
      );
      data.trueRanges.push(tr);
      if (data.trueRanges.length > this.params.atr_period + 10) {
        data.trueRanges.shift();
      }
    }
    
    data.prices.push(bar.close);
    data.highs.push(bar.high);
    data.lows.push(bar.low);

    const maxPeriod = Math.max(this.params.lookback, this.params.atr_period) + 20;
    if (data.prices.length > maxPeriod) {
      data.prices.shift();
      data.highs.shift();
      data.lows.shift();
    }

    const stoch = this.getStochastic(data);
    const atr = this.calculateATR(data);
    const supports = this.findSupportLevels(data);
    const resistance = this.findResistanceLevel(data);
    
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

        // Stop loss
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        // ATR-based trailing stop
        if (atr !== null) {
          const trailingStop = newHighest - atr * this.params.atr_multiplier;
          if (bar.close < trailingStop) {
            ctx.close(bar.tokenId);
            this.entryPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
            return;
          }
        }

        // Resistance or overbought
        if ((resistance !== null && bar.close >= resistance) || stoch.k >= this.params.stoch_overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      const nearSupport = supports.some(s => Math.abs(bar.close - s) / s < this.params.bounce_threshold);
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
