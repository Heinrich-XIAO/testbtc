import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Price Range Breakout Strategy 221
 * - Identifies consolidation ranges
 * - Enters on breakout from range
 */

export interface PriceRangeBreakout221Params extends StrategyParams {
  lookback: number;
  range_threshold: number;
  breakout_multiplier: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: PriceRangeBreakout221Params = {
  lookback: 15,
  range_threshold: 0.03,
  breakout_multiplier: 1.2,
  stop_loss: 0.05,
  trailing_stop: 0.03,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<PriceRangeBreakout221Params> | null {
  const paramsPath = path.join(__dirname, 'strat_price_range_breakout_221.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<PriceRangeBreakout221Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof PriceRangeBreakout221Params] = value;
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
  rangeHigh: number;
  rangeLow: number;
  inConsolidation: boolean;
}

export class PriceRangeBreakout221Strategy implements Strategy {
  params: PriceRangeBreakout221Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<PriceRangeBreakout221Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as PriceRangeBreakout221Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, {
        prices: [],
        highs: [],
        lows: [],
        rangeHigh: 0,
        rangeLow: 0,
        inConsolidation: false,
      });
    }
    return this.tokenData.get(tokenId)!;
  }

  private detectConsolidation(data: TokenData): void {
    if (data.highs.length < this.params.lookback) {
      data.inConsolidation = false;
      return;
    }

    const recentHighs = data.highs.slice(-this.params.lookback);
    const recentLows = data.lows.slice(-this.params.lookback);
    
    const rangeHigh = Math.max(...recentHighs);
    const rangeLow = Math.min(...recentLows);
    const range = (rangeHigh - rangeLow) / rangeLow;

    data.rangeHigh = rangeHigh;
    data.rangeLow = rangeLow;
    data.inConsolidation = range < this.params.range_threshold;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const data = this.getOrCreateData(bar.tokenId);
    
    data.prices.push(bar.close);
    data.highs.push(bar.high);
    data.lows.push(bar.low);

    const maxPeriod = this.params.lookback + 10;
    if (data.prices.length > maxPeriod) {
      data.prices.shift();
      data.highs.shift();
      data.lows.shift();
    }

    this.detectConsolidation(data);

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
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: breakout above range high after consolidation
      if (data.inConsolidation && data.rangeHigh > 0) {
        const breakoutLevel = data.rangeHigh * this.params.breakout_multiplier;
        if (bar.close > data.rangeHigh && bar.close < breakoutLevel) {
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
  }

  onComplete(_ctx: BacktestContext): void {}
}
