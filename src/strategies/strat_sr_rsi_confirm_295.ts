import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SR RSI Confirm 295
 * - Uses RSI instead of/alongside stochastic for entry confirmation
 * - RSI oversold=30 is less extreme than stochastic=16-22
 * - Moderate approach to potentially generate more trades
 */

export interface SRRsiConfirm295Params extends StrategyParams {
  base_lookback: number;
  min_lookback: number;
  max_lookback: number;
  volatility_period: number;
  bounce_threshold: number;
  rsi_period: number;
  rsi_oversold: number;
  rsi_overbought: number;
  trend_period: number;
  trend_threshold: number;
  momentum_period: number;
  momentum_threshold: number;
  min_bounce_bars: number;
  stop_loss: number;
  trailing_stop: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: SRRsiConfirm295Params = {
  base_lookback: 18,
  min_lookback: 8,
  max_lookback: 38,
  volatility_period: 10,
  bounce_threshold: 0.028,
  rsi_period: 14,
  rsi_oversold: 30,
  rsi_overbought: 70,
  trend_period: 20,
  trend_threshold: -0.005,
  momentum_period: 2,
  momentum_threshold: 0.005,
  min_bounce_bars: 1,
  stop_loss: 0.075,
  trailing_stop: 0.055,
  profit_target: 0.15,
  max_hold_bars: 35,
  risk_percent: 0.24,
};

function loadSavedParams(): Partial<SRRsiConfirm295Params> | null {
  const paramsPath = path.join(__dirname, 'strat_sr_rsi_confirm_295.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<SRRsiConfirm295Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof SRRsiConfirm295Params] = value;
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
  gains: number[];
  losses: number[];
  consecutiveBounces: number;
}

export class SRRsiConfirm295Strategy implements Strategy {
  params: SRRsiConfirm295Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();
  private barsHeld: Map<string, number> = new Map();

  constructor(params: Partial<SRRsiConfirm295Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as SRRsiConfirm295Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, { prices: [], highs: [], lows: [], gains: [], losses: [], consecutiveBounces: 0 });
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

  private getTrendStrength(prices: number[]): number {
    if (prices.length < this.params.trend_period) return 0;
    const recent = prices.slice(-this.params.trend_period);
    return (recent[recent.length - 1] - recent[0]) / recent[0];
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

  private getRSI(data: TokenData): number | null {
    if (data.prices.length < this.params.rsi_period + 1) return null;

    // Calculate gains/losses for current bar
    const current = data.prices[data.prices.length - 1];
    const prev = data.prices[data.prices.length - 2];
    const change = current - prev;
    
    data.gains.push(change > 0 ? change : 0);
    data.losses.push(change < 0 ? -change : 0);
    
    if (data.gains.length > this.params.rsi_period) data.gains.shift();
    if (data.losses.length > this.params.rsi_period) data.losses.shift();
    
    if (data.gains.length < this.params.rsi_period) return null;

    const avgGain = data.gains.reduce((a, b) => a + b, 0) / this.params.rsi_period;
    const avgLoss = data.losses.reduce((a, b) => a + b, 0) / this.params.rsi_period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
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

    const maxPeriod = Math.max(this.params.max_lookback, this.params.trend_period, this.params.rsi_period) + 20;
    if (data.prices.length > maxPeriod) {
      data.prices.shift();
      data.highs.shift();
      data.lows.shift();
    }

    const prevPrice = data.prices.length > 1 ? data.prices[data.prices.length - 2] : bar.close;
    if (bar.close > prevPrice) data.consecutiveBounces++;
    else data.consecutiveBounces = 0;

    const rsi = this.getRSI(data);
    const adaptiveLookback = this.getAdaptiveLookback(data);
    const trendStrength = this.getTrendStrength(data.prices);
    const momentum = this.getMomentum(data.prices);
    const supports = this.findSupportLevels(data, adaptiveLookback);
    const resistance = this.findResistanceLevel(data, adaptiveLookback);
    
    if (rsi === null || supports.length === 0) return;

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
        if ((resistance !== null && bar.close >= resistance) || rsi >= this.params.rsi_overbought) {
          this.closePosition(ctx, bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      const nearSupport = supports.some(s => Math.abs(bar.close - s) / s < this.params.bounce_threshold);
      const rsiOversold = rsi <= this.params.rsi_oversold;
      const trendOk = trendStrength >= this.params.trend_threshold;
      const momentumOk = momentum >= this.params.momentum_threshold;
      const multiBarBounce = data.consecutiveBounces >= this.params.min_bounce_bars;

      if (nearSupport && multiBarBounce && rsiOversold && trendOk && momentumOk) {
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
