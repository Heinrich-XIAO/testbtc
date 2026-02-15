import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Range Mean Revert 229
 * - Mean reversion strategy for range-bound markets
 * - Detects price range and enters when price is at extremes
 * - Exits when price returns to mean
 */

export interface RangeMeanRevert229Params extends StrategyParams {
  lookback: number;
  range_percentile: number;
  oversold_percentile: number;
  overbought_percentile: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: RangeMeanRevert229Params = {
  lookback: 25,
  range_percentile: 0.1,
  oversold_percentile: 0.15,
  overbought_percentile: 0.85,
  stop_loss: 0.08,
  trailing_stop: 0.05,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<RangeMeanRevert229Params> | null {
  const paramsPath = path.join(__dirname, 'strat_range_mean_revert_229.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<RangeMeanRevert229Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof RangeMeanRevert229Params] = value;
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
}

export class RangeMeanRevert229Strategy implements Strategy {
  params: RangeMeanRevert229Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<RangeMeanRevert229Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as RangeMeanRevert229Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, { prices: [] });
    }
    return this.tokenData.get(tokenId)!;
  }

  private isRangeBound(data: TokenData): boolean {
    if (data.prices.length < this.params.lookback) return false;
    
    const recentPrices = data.prices.slice(-this.params.lookback);
    const high = Math.max(...recentPrices);
    const low = Math.min(...recentPrices);
    const mean = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    
    // Check if range is tight (within range_percentile of mean)
    const range = (high - low) / mean;
    return range < this.params.range_percentile * 2;
  }

  private getPercentileRank(data: TokenData): number {
    if (data.prices.length < this.params.lookback) return 0.5;
    
    const recentPrices = data.prices.slice(-this.params.lookback);
    const currentPrice = data.prices[data.prices.length - 1];
    const high = Math.max(...recentPrices);
    const low = Math.min(...recentPrices);
    
    if (high === low) return 0.5;
    return (currentPrice - low) / (high - low);
  }

  private getMean(data: TokenData): number {
    if (data.prices.length < this.params.lookback) return data.prices[data.prices.length - 1];
    
    const recentPrices = data.prices.slice(-this.params.lookback);
    return recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const data = this.getOrCreateData(bar.tokenId);
    
    data.prices.push(bar.close);

    const maxPeriod = this.params.lookback + 10;
    if (data.prices.length > maxPeriod) {
      data.prices.shift();
    }

    const percentileRank = this.getPercentileRank(data);
    const mean = this.getMean(data);
    const rangeBound = this.isRangeBound(data);
    
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

        // Exit at mean (mean reversion complete)
        if (bar.close >= mean) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        // Exit if overbought
        if (percentileRank >= this.params.overbought_percentile) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: range-bound market, oversold, and bouncing
      const oversold = percentileRank <= this.params.oversold_percentile;
      const bouncing = bar.close > prevPrice;

      if (rangeBound && oversold && bouncing) {
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
