import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter92CParams extends StrategyParams {
  loess_window: number;
  loess_degree: number;
  loess_bandwidth: number;
  trend_threshold: number;
  stoch_oversold: number;
  stoch_k_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter92CParams = {
  loess_window: 15,
  loess_degree: 1,
  loess_bandwidth: 0.3,
  trend_threshold: 0.01,
  stoch_oversold: 16,
  stoch_k_period: 14,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter92CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter92_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function tricubeKernel(u: number): number {
  const absU = Math.abs(u);
  if (absU >= 1) return 0;
  return Math.pow(1 - Math.pow(absU, 3), 3);
}

function localLinearRegression(x: number[], y: number[], queryPoint: number, bandwidth: number): { slope: number; fitted: number } | null {
  if (x.length < 3) return null;
  
  const halfWidth = Math.floor(bandwidth * x.length);
  let sumW = 0, sumWX = 0, sumWY = 0, sumWXX = 0, sumWXY = 0;
  
  for (let i = 0; i < x.length; i++) {
    const u = (x[i] - queryPoint) / halfWidth;
    const w = tricubeKernel(u);
    sumW += w;
    sumWX += w * x[i];
    sumWY += w * y[i];
    sumWXX += w * x[i] * x[i];
    sumWXY += w * x[i] * y[i];
  }
  
  if (sumW < 0.0001) return null;
  
  const denom = sumW * sumWXX - sumWX * sumWX;
  if (Math.abs(denom) < 0.0001) return null;
  
  const slope = (sumW * sumWXY - sumWX * sumWY) / denom;
  const intercept = (sumWY - slope * sumWX) / sumW;
  const fitted = intercept + slope * queryPoint;
  
  return { slope, fitted };
}

function loessTrend(closes: number[], window: number, bandwidth: number): { slope: number; acceleration: number } | null {
  if (closes.length < window + 2) return null;
  
  const recentCloses = closes.slice(-window);
  const x: number[] = recentCloses.map((_, i) => i);
  const y: number[] = recentCloses;
  
  const current = localLinearRegression(x, y, window - 1, bandwidth);
  const prev = localLinearRegression(x, y, window - 2, bandwidth);
  
  if (current === null || prev === null) return null;
  
  const acceleration = current.slope - prev.slope;
  
  return { slope: current.slope, acceleration };
}

function stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period) return null;
  const highSlice = highs.slice(-period);
  const lowSlice = lows.slice(-period);
  const highest = Math.max(...highSlice);
  const lowest = Math.min(...lowSlice);
  if (highest === lowest) return 50;
  return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
}

function supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function capPush<T>(arr: T[], val: T, max = 500): void {
  arr.push(val);
  if (arr.length > max) arr.shift();
}

export class StratIter92CStrategy implements Strategy {
  params: StratIter92CParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private accelerations: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter92CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter92CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.accelerations.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const accelerations = this.accelerations.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    capPush(closes, bar.close);
    capPush(highs, bar.high);
    capPush(lows, bar.low);

    const trend = loessTrend(closes, this.params.loess_window, this.params.loess_bandwidth);
    if (trend !== null) {
      capPush(accelerations, trend.acceleration);
    }

    const k = stochasticK(closes, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      capPush(kVals, k);
    }

    const sr = supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

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
    if (kVals.length < 3 || accelerations.length < 2) return;

    const currK = kVals[kVals.length - 1];
    const prevK = kVals[kVals.length - 2];
    const kRising = currK > prevK + 1;
    const oversold = currK <= this.params.stoch_oversold;

    const currAccel = accelerations[accelerations.length - 1];
    const prevAccel = accelerations[accelerations.length - 2];
    const accelerationTurningUp = currAccel > prevAccel && currAccel > this.params.trend_threshold;

    const nearSupport = bar.close <= sr.support * 1.02;

    if (kRising && oversold && accelerationTurningUp && nearSupport) {
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
