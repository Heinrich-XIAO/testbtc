import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Stoch RSI 231
 * - Stochastic RSI strategy
 * - RSI of RSI for more sensitive signals
 * - Enters on oversold bounce, exits on overbought
 */

export interface StochRSI231Params extends StrategyParams {
  rsi_period: number;
  stoch_period: number;
  k_smooth: number;
  d_smooth: number;
  oversold: number;
  overbought: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: StochRSI231Params = {
  rsi_period: 14,
  stoch_period: 14,
  k_smooth: 3,
  d_smooth: 3,
  oversold: 20,
  overbought: 80,
  stop_loss: 0.08,
  trailing_stop: 0.05,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<StochRSI231Params> | null {
  const paramsPath = path.join(__dirname, 'strat_stoch_rsi_231.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<StochRSI231Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof StochRSI231Params] = value;
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
  rsiValues: number[];
  kValues: number[];
  dValues: number[];
}

export class StochRSI231Strategy implements Strategy {
  params: StochRSI231Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<StochRSI231Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StochRSI231Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, {
        prices: [],
        rsiValues: [],
        kValues: [],
        dValues: [],
      });
    }
    return this.tokenData.get(tokenId)!;
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

  private calculateStochRSI(data: TokenData): { k: number; d: number } | null {
    if (data.rsiValues.length < this.params.stoch_period) return null;
    
    const rsiSlice = data.rsiValues.slice(-this.params.stoch_period);
    const high = Math.max(...rsiSlice);
    const low = Math.min(...rsiSlice);
    const current = data.rsiValues[data.rsiValues.length - 1];
    
    if (high === low) return null;
    
    const rawK = ((current - low) / (high - low)) * 100;
    
    // Smooth K
    data.kValues.push(rawK);
    if (data.kValues.length > this.params.k_smooth) data.kValues.shift();
    if (data.kValues.length < this.params.k_smooth) return null;
    
    const k = data.kValues.reduce((a, b) => a + b, 0) / data.kValues.length;
    
    // Smooth D
    data.dValues.push(k);
    if (data.dValues.length > this.params.d_smooth) data.dValues.shift();
    if (data.dValues.length < this.params.d_smooth) return null;
    
    const d = data.dValues.reduce((a, b) => a + b, 0) / data.dValues.length;
    
    return { k, d };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const data = this.getOrCreateData(bar.tokenId);
    
    data.prices.push(bar.close);

    const maxPeriod = this.params.rsi_period + this.params.stoch_period + 20;
    if (data.prices.length > maxPeriod) {
      data.prices.shift();
    }

    const rsi = this.calculateRSI(data);
    if (rsi !== null) {
      data.rsiValues.push(rsi);
      if (data.rsiValues.length > this.params.stoch_period + 10) {
        data.rsiValues.shift();
      }
    }

    const stochRSI = this.calculateStochRSI(data);
    if (!stochRSI) return;

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

        // Trailing stop
        if (bar.close < newHighest * (1 - this.params.trailing_stop)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        // Exit on overbought
        if (stochRSI.k >= this.params.overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: oversold StochRSI with K crossing above D
      const oversold = stochRSI.k <= this.params.oversold;
      const crossingUp = stochRSI.k > stochRSI.d;
      const bouncing = bar.close > prevPrice;

      if (oversold && crossingUp && bouncing) {
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
