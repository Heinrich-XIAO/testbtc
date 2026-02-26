import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

function loadSavedParams<T extends StrategyParams>(fileName: string): Partial<T> | null {
  const paramsPath = path.join(__dirname, fileName);
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function capPush(values: number[], value: number, max = 500): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return 50;
  return ((closes[closes.length - 1] - l) / (h - l)) * 100;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function empiricalCDF(data: number[], value: number): number {
  if (data.length === 0) return 0.5;
  let count = 0;
  for (const d of data) {
    if (d <= value) count++;
  }
  return count / data.length;
}

function estimateClaytonTheta(u1: number[], u2: number[]): number | null {
  if (u1.length < 10 || u2.length < 10) return null;
  
  let sum = 0;
  const n = u1.length;
  
  for (let i = 0; i < n; i++) {
    const u = Math.max(0.001, Math.min(0.999, u1[i]));
    const v = Math.max(0.001, Math.min(0.999, u2[i]));
    sum += Math.log(Math.max(0.0001, u * v));
  }
  
  const tau = -4 * sum / n - 1;
  const theta = Math.max(0.1, 2 * tau / (1 - tau));
  
  return theta;
}

function claytonLowerTailDependency(theta: number): number {
  if (theta <= 0) return 0;
  return Math.pow(2, -1 / theta);
}

function computeCopulaDependency(closes: number[], windowSize: number, paramMin: number, paramMax: number): { tailDependency: number; theta: number } | null {
  if (closes.length < windowSize + 2) return null;
  
  const window = closes.slice(-(windowSize + 1));
  const returns: number[] = [];
  
  for (let i = 1; i < window.length; i++) {
    const r = (window[i] - window[i - 1]) / window[i - 1];
    returns.push(r);
  }
  
  if (returns.length < windowSize) return null;
  
  const u1: number[] = [];
  const u2: number[] = [];
  
  for (let i = 1; i < returns.length; i++) {
    const prevReturns = returns.slice(0, i);
    u1.push(empiricalCDF(prevReturns, returns[i - 1]));
    u2.push(empiricalCDF(prevReturns, returns[i]));
  }
  
  if (u1.length < 10) return null;
  
  let theta = estimateClaytonTheta(u1, u2);
  if (theta === null) return null;
  
  theta = Math.max(paramMin, Math.min(paramMax, theta));
  
  const tailDependency = claytonLowerTailDependency(theta);
  
  return { tailDependency, theta };
}

abstract class BaseIterStrategy<P extends StrategyParams> implements Strategy {
  params: P;
  protected series: Map<string, TokenSeries> = new Map();
  protected bars: Map<string, number> = new Map();
  protected entryPrice: Map<string, number> = new Map();
  protected entryBar: Map<string, number> = new Map();

  constructor(fileName: string, defaults: P, params: Partial<P>) {
    const saved = loadSavedParams<P>(fileName);
    this.params = { ...defaults, ...saved, ...params } as P;
  }

  onInit(_ctx: BacktestContext): void {}

  protected nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  protected open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
    const cash = ctx.getCapital() * riskPercent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (result.success) {
      this.entryPrice.set(bar.tokenId, bar.close);
      this.entryBar.set(bar.tokenId, barNum);
      return true;
    }
    return false;
  }

  protected close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter83DParams extends StrategyParams {
  window_size: number;
  copula_param_min: number;
  copula_param_max: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter83DStrategy extends BaseIterStrategy<StratIter83DParams> {
  constructor(params: Partial<StratIter83DParams> = {}) {
    super('strat_iter83_d.params.json', {
      window_size: 40,
      copula_param_min: 1.0,
      copula_param_max: 3.0,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const copulaResult = computeCopulaDependency(
      series.closes,
      this.params.window_size,
      this.params.copula_param_min,
      this.params.copula_param_max
    );

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          (sr && bar.high >= sr.resistance * 0.98) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || !copulaResult) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    
    const tailDepThreshold = 0.3;
    const highTailDependency = copulaResult.tailDependency > tailDepThreshold;

    if (nearSupport && stochOversold && highTailDependency) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
