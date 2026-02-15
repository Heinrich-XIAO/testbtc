import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Support/Resistance with Stochastic Confirmation
 * - Identifies support/resistance levels from recent highs/lows
 * - Enters when price bounces off support with stochastic confirmation
 */

export interface SupportResistanceStoch216Params extends StrategyParams {
  lookback: number;
  bounce_threshold: number;
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: SupportResistanceStoch216Params = {
  lookback: 20,
  bounce_threshold: 0.02,
  stoch_k_period: 14,
  stoch_d_period: 3,
  stoch_oversold: 25,
  stoch_overbought: 75,
  stop_loss: 0.05,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<SupportResistanceStoch216Params> | null {
  const paramsPath = path.join(__dirname, 'strat_support_resistance_stoch_216.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<SupportResistanceStoch216Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof SupportResistanceStoch216Params] = value;
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

export class SupportResistanceStoch216Strategy implements Strategy {
  params: SupportResistanceStoch216Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<SupportResistanceStoch216Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as SupportResistanceStoch216Params;
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

  private findSupportLevel(data: TokenData): number | null {
    if (data.lows.length < this.params.lookback) return null;
    
    const recentLows = data.lows.slice(-this.params.lookback);
    // Find the lowest low as primary support
    return Math.min(...recentLows);
  }

  private findResistanceLevel(data: TokenData): number | null {
    if (data.highs.length < this.params.lookback) return null;
    
    const recentHighs = data.highs.slice(-this.params.lookback);
    // Find the highest high as primary resistance
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

    const maxPeriod = Math.max(this.params.lookback, this.params.stoch_k_period) + 10;
    if (data.prices.length > maxPeriod) {
      data.prices.shift();
      data.highs.shift();
      data.lows.shift();
    }

    const stoch = this.getStochastic(data);
    const support = this.findSupportLevel(data);
    const resistance = this.findResistanceLevel(data);
    
    if (!stoch || support === null) return;

    const position = ctx.getPosition(bar.tokenId);
    const prevPrice = data.prices.length > 1 ? data.prices[data.prices.length - 2] : bar.close;

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      
      if (entry) {
        // Stop loss
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }

        // Take profit at resistance or when stochastic is overbought
        if ((resistance !== null && bar.close >= resistance) || stoch.k >= this.params.stoch_overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry conditions:
      // 1. Price near support (within bounce_threshold)
      // 2. Price bouncing up (current > previous)
      // 3. Stochastic oversold and crossing up
      const nearSupport = Math.abs(bar.close - support) / support < this.params.bounce_threshold;
      const bouncing = bar.close > prevPrice;
      const stochOversold = stoch.k <= this.params.stoch_oversold && stoch.k > stoch.d;

      if (nearSupport && bouncing && stochOversold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
