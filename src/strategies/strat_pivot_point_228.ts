import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Pivot Point 228
 * - Classic pivot point trading strategy
 * - Calculates pivot, support and resistance levels
 * - Enters on bounce from support levels
 */

export interface PivotPoint228Params extends StrategyParams {
  pivot_period: number;
  bounce_threshold: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: PivotPoint228Params = {
  pivot_period: 20,
  bounce_threshold: 0.025,
  stop_loss: 0.08,
  trailing_stop: 0.05,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<PivotPoint228Params> | null {
  const paramsPath = path.join(__dirname, 'strat_pivot_point_228.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<PivotPoint228Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof PivotPoint228Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

interface TokenData {
  highs: number[];
  lows: number[];
  closes: number[];
}

export class PivotPoint228Strategy implements Strategy {
  params: PivotPoint228Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<PivotPoint228Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as PivotPoint228Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, {
        highs: [],
        lows: [],
        closes: [],
      });
    }
    return this.tokenData.get(tokenId)!;
  }

  private calculatePivotLevels(data: TokenData): { pivot: number; s1: number; s2: number; r1: number; r2: number } | null {
    if (data.highs.length < this.params.pivot_period) return null;
    
    const recentHighs = data.highs.slice(-this.params.pivot_period);
    const recentLows = data.lows.slice(-this.params.pivot_period);
    const recentCloses = data.closes.slice(-this.params.pivot_period);
    
    const high = Math.max(...recentHighs);
    const low = Math.min(...recentLows);
    const close = recentCloses[recentCloses.length - 1];
    
    const pivot = (high + low + close) / 3;
    const s1 = 2 * pivot - high;
    const s2 = pivot - (high - low);
    const r1 = 2 * pivot - low;
    const r2 = pivot + (high - low);
    
    return { pivot, s1, s2, r1, r2 };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const data = this.getOrCreateData(bar.tokenId);
    
    data.highs.push(bar.high);
    data.lows.push(bar.low);
    data.closes.push(bar.close);

    const maxPeriod = this.params.pivot_period + 10;
    if (data.highs.length > maxPeriod) {
      data.highs.shift();
      data.lows.shift();
      data.closes.shift();
    }

    const levels = this.calculatePivotLevels(data);
    if (!levels) return;

    const position = ctx.getPosition(bar.tokenId);
    const prevClose = data.closes.length > 1 ? data.closes[data.closes.length - 2] : bar.close;

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

        // Take profit at resistance levels
        if (bar.close >= levels.r1) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: near S1 or S2 and bouncing
      const nearS1 = Math.abs(bar.close - levels.s1) / levels.s1 < this.params.bounce_threshold;
      const nearS2 = Math.abs(bar.close - levels.s2) / levels.s2 < this.params.bounce_threshold;
      const bouncing = bar.close > prevClose;

      if ((nearS1 || nearS2) && bouncing) {
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
