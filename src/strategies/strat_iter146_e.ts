import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter146EParams extends StrategyParams {
  trend_lookback: number;
  trend_slope_min: number;
  adx_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter146EParams = {
  trend_lookback: 50,
  trend_slope_min: 0.001,
  adx_threshold: 25,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 45,
  risk_percent: 0.25,
  sr_lookback: 80,
};

function loadSavedParams(): Partial<StratIter146EParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter146_e.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter146EStrategy implements Strategy {
  params: StratIter146EParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter146EParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter146EParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calcSlope(closes: number[], lookback: number): number | null {
    if (closes.length < lookback) return null;
    const slice = closes.slice(-lookback);
    const n = slice.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = slice.reduce((a, b) => a + b, 0);
    const sumXY = slice.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return null;
    return (n * sumXY - sumX * sumY) / denominator;
  }

  private calcADX(highs: number[], lows: number[], closes: number[], period: number): number | null {
    if (closes.length < period * 2) return null;
    const tr: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
      const h = highs[i] - highs[i - 1];
      const l = lows[i - 1] - lows[i];
      tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
      plusDM.push(h > l && h > 0 ? h : 0);
      minusDM.push(l > h && l > 0 ? l : 0);
    }
    
    if (tr.length < period) return null;
    
    const smoothTR = tr.slice(-period).reduce((a, b) => a + b, 0) / period;
    const smoothPlusDM = plusDM.slice(-period).reduce((a, b) => a + b, 0) / period;
    const smoothMinusDM = minusDM.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    const plusDI = (smoothPlusDM / smoothTR) * 100;
    const minusDI = (smoothMinusDM / smoothTR) * 100;
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    
    return dx;
  }

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period) return null;
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
  }

  private supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
    if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
    return {
      support: Math.min(...lows.slice(-(lookback + 1), -1)),
      resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 300) closes.shift();
    if (highs.length > 300) highs.shift();
    if (lows.length > 300) lows.shift();

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.low <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
        if (bar.high >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (closes.length < this.params.trend_lookback * 2) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const slope = this.calcSlope(closes, this.params.trend_lookback);
    const adx = this.calcADX(highs, lows, closes, 14);
    const k = this.stochasticK(closes, highs, lows, 14);

    const uptrend = slope !== null && slope > this.params.trend_slope_min;
    const strongTrend = adx !== null && adx > this.params.adx_threshold;
    const nearSupport = bar.low <= sr.support * 1.02;
    const stochOversold = k !== null && k < this.params.stoch_oversold;

    if (uptrend && strongTrend && nearSupport && stochOversold) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
