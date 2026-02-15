import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SR No Trend Higher Profit 312
 * - Based on 302 but with higher profit target (18%)
 * - Tests if letting winners run improves returns
 */

export interface SRNoTrendHigherProfit312Params extends StrategyParams {
  base_lookback: number;
  min_lookback: number;
  max_lookback: number;
  volatility_period: number;
  bounce_threshold: number;
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  momentum_period: number;
  momentum_threshold: number;
  min_bounce_bars: number;
  stop_loss: number;
  trailing_stop: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: SRNoTrendHigherProfit312Params = {
  base_lookback: 20,
  min_lookback: 14,
  max_lookback: 36,
  volatility_period: 12,
  bounce_threshold: 0.022,
  stoch_k_period: 18,
  stoch_d_period: 5,
  stoch_oversold: 24,
  stoch_overbought: 86,
  momentum_period: 3,
  momentum_threshold: 0.006,
  min_bounce_bars: 1,
  stop_loss: 0.065,
  trailing_stop: 0.07,
  profit_target: 0.18, // Higher than 302's 0.14
  max_hold_bars: 40, // Longer hold to reach higher target
  risk_percent: 0.32,
};

function loadSavedParams(): Partial<SRNoTrendHigherProfit312Params> | null {
  const paramsPath = path.join(__dirname, 'strat_sr_no_trend_higher_profit_312.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<SRNoTrendHigherProfit312Params> = {};
    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') params[key as keyof SRNoTrendHigherProfit312Params] = value;
      }
    }
    return params;
  } catch { return null; }
}

interface TokenData {
  prices: number[];
  highs: number[];
  lows: number[];
  kValues: number[];
  consecutiveBounces: number;
}

export class SRNoTrendHigherProfit312Strategy implements Strategy {
  params: SRNoTrendHigherProfit312Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();
  private barsHeld: Map<string, number> = new Map();

  constructor(params: Partial<SRNoTrendHigherProfit312Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as SRNoTrendHigherProfit312Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, { prices: [], highs: [], lows: [], kValues: [], consecutiveBounces: 0 });
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
    if (data.prices.length < this.params.volatility_period) return this.params.base_lookback;
    const recentVol = this.calcVolatility(data.prices.slice(-this.params.volatility_period));
    const historicalVol = this.calcVolatility(data.prices.slice(-this.params.max_lookback));
    if (historicalVol === 0) return this.params.base_lookback;
    const volRatio = recentVol / historicalVol;
    let adaptiveLookback = Math.round(this.params.base_lookback / volRatio);
    return Math.max(this.params.min_lookback, Math.min(this.params.max_lookback, adaptiveLookback));
  }

  private getMomentum(prices: number[]): number {
    if (prices.length < this.params.momentum_period + 1) return 0;
    const current = prices[prices.length - 1];
    const past = prices[prices.length - 1 - this.params.momentum_period];
    return (current - past) / past;
  }

  private findSupportLevels(data: TokenData, lookback: number): number[] {
    if (data.lows.length < lookback) return [];
    const recentLows = data.lows.slice(-lookback);
    const sorted = [...recentLows].sort((a, b) => a - b);
    return sorted.slice(0, 3);
  }

  private findResistanceLevel(data: TokenData, lookback: number): number | null {
    if (data.highs.length < lookback) return null;
    return Math.max(...data.highs.slice(-lookback));
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

  private closePosition(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.highestPrice.delete(tokenId);
    this.barsHeld.delete(tokenId);
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

    const prevPrice = data.prices.length > 1 ? data.prices[data.prices.length - 2] : bar.close;
    if (bar.close > prevPrice) data.consecutiveBounces++;
    else data.consecutiveBounces = 0;

    const stoch = this.getStochastic(data);
    const adaptiveLookback = this.getAdaptiveLookback(data);
    const momentum = this.getMomentum(data.prices);
    const supports = this.findSupportLevels(data, adaptiveLookback);
    const resistance = this.findResistanceLevel(data, adaptiveLookback);
    
    if (!stoch || supports.length === 0) return;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const highest = this.highestPrice.get(bar.tokenId) ?? bar.close;
      const bars = this.barsHeld.get(bar.tokenId) ?? 0;
      this.barsHeld.set(bar.tokenId, bars + 1);
      
      if (entry) {
        if (bar.close > highest) this.highestPrice.set(bar.tokenId, bar.close);
        const newHighest = this.highestPrice.get(bar.tokenId)!;

        if (bar.close < entry * (1 - this.params.stop_loss)) { this.closePosition(ctx, bar.tokenId); return; }
        if (bar.close < newHighest * (1 - this.params.trailing_stop)) { this.closePosition(ctx, bar.tokenId); return; }
        if (bar.close >= entry * (1 + this.params.profit_target)) { this.closePosition(ctx, bar.tokenId); return; }
        if (bars >= this.params.max_hold_bars) { this.closePosition(ctx, bar.tokenId); return; }
        if ((resistance !== null && bar.close >= resistance) || stoch.k >= this.params.stoch_overbought) {
          this.closePosition(ctx, bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      const nearSupport = supports.some(s => Math.abs(bar.close - s) / s < this.params.bounce_threshold);
      const stochOversold = stoch.k <= this.params.stoch_oversold && stoch.k > stoch.d;
      const momentumOk = momentum >= this.params.momentum_threshold;
      const multiBarBounce = data.consecutiveBounces >= this.params.min_bounce_bars;

      if (nearSupport && multiBarBounce && stochOversold && momentumOk) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
            this.barsHeld.set(bar.tokenId, 0);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
