import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Breakout Confirmation 230
 * - Breakout strategy with volatility confirmation
 * - Waits for price to break above resistance with high volatility
 * - Uses trailing stop to ride momentum
 */

export interface BreakoutConfirmation230Params extends StrategyParams {
  lookback: number;
  breakout_threshold: number;
  volatility_period: number;
  volatility_multiplier: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: BreakoutConfirmation230Params = {
  lookback: 20,
  breakout_threshold: 0.015,
  volatility_period: 12,
  volatility_multiplier: 1.2,
  stop_loss: 0.07,
  trailing_stop: 0.045,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<BreakoutConfirmation230Params> | null {
  const paramsPath = path.join(__dirname, 'strat_breakout_confirmation_230.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<BreakoutConfirmation230Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof BreakoutConfirmation230Params] = value;
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
}

export class BreakoutConfirmation230Strategy implements Strategy {
  params: BreakoutConfirmation230Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<BreakoutConfirmation230Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as BreakoutConfirmation230Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, { prices: [], highs: [] });
    }
    return this.tokenData.get(tokenId)!;
  }

  private calcVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const sqDiffs = prices.reduce((sum, p) => sum + (p - mean) * (p - mean), 0);
    return Math.sqrt(sqDiffs / prices.length) / mean;
  }

  private getResistance(data: TokenData): number | null {
    if (data.highs.length < this.params.lookback) return null;
    
    // Resistance is the highest high excluding the current bar
    const recentHighs = data.highs.slice(-this.params.lookback - 1, -1);
    return Math.max(...recentHighs);
  }

  private isVolatilityHigh(data: TokenData): boolean {
    if (data.prices.length < this.params.volatility_period * 2) return false;
    
    const recentVol = this.calcVolatility(data.prices.slice(-this.params.volatility_period));
    const historicalVol = this.calcVolatility(data.prices.slice(-this.params.volatility_period * 2, -this.params.volatility_period));
    
    if (historicalVol === 0) return false;
    return recentVol > historicalVol * this.params.volatility_multiplier;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const data = this.getOrCreateData(bar.tokenId);
    
    data.prices.push(bar.close);
    data.highs.push(bar.high);

    const maxPeriod = Math.max(this.params.lookback, this.params.volatility_period * 2) + 10;
    if (data.prices.length > maxPeriod) {
      data.prices.shift();
      data.highs.shift();
    }

    const resistance = this.getResistance(data);
    const highVolatility = this.isVolatilityHigh(data);
    
    const position = ctx.getPosition(bar.tokenId);

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
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: breakout above resistance with volatility confirmation
      if (resistance !== null) {
        const breakoutAmount = (bar.close - resistance) / resistance;
        const isBreakout = breakoutAmount > this.params.breakout_threshold;

        if (isBreakout && highVolatility) {
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
