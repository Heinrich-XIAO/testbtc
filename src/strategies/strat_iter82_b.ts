import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
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

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function computeFluctuation(returns: number[], scale: number, q: number): number | null {
  if (returns.length < scale * 2) return null;
  
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  let cumSum = 0;
  const profile: number[] = [];
  for (const r of returns) {
    cumSum += r - mean;
    profile.push(cumSum);
  }
  
  const numSegments = Math.floor(profile.length / scale);
  if (numSegments < 2) return null;
  
  let totalFluctuation = 0;
  let count = 0;
  
  for (let v = 0; v < 2; v++) {
    const startIdx = v === 0 ? 0 : profile.length - numSegments * scale;
    
    for (let i = 0; i < numSegments; i++) {
      const segmentStart = startIdx + i * scale;
      const segment = profile.slice(segmentStart, segmentStart + scale);
      const indices = segment.map((_, idx) => idx);
      const { slope, intercept } = linearRegression(indices, segment);
      
      let variance = 0;
      for (let j = 0; j < scale; j++) {
        const detrended = segment[j] - (intercept + slope * j);
        variance += detrended * detrended;
      }
      const f2 = variance / scale;
      
      if (f2 > 0) {
        if (q === 0) {
          totalFluctuation += Math.log(f2);
        } else {
          totalFluctuation += Math.pow(f2, q / 2);
        }
        count++;
      }
    }
  }
  
  if (count === 0) return null;
  
  if (q === 0) {
    return Math.exp(totalFluctuation / count);
  }
  return Math.pow(totalFluctuation / count, 1 / q);
}

function computeHurstExponent(returns: number[], q: number): number | null {
  const scales = [4, 8, 16, 32];
  const logScales: number[] = [];
  const logFluctuations: number[] = [];
  
  for (const s of scales) {
    const f = computeFluctuation(returns, s, q);
    if (f !== null && f > 0) {
      logScales.push(Math.log(s));
      logFluctuations.push(Math.log(f));
    }
  }
  
  if (logScales.length < 3) return null;
  
  const { slope } = linearRegression(logScales, logFluctuations);
  return slope;
}

function computeMultifractalSpectrum(returns: number[], qMin: number, qMax: number): { width: number; hValues: number[] } | null {
  const qValues: number[] = [];
  for (let q = qMin; q <= qMax; q += 0.5) {
    qValues.push(q);
  }
  
  const hValues: number[] = [];
  for (const q of qValues) {
    const h = computeHurstExponent(returns, q);
    if (h !== null && !isNaN(h) && isFinite(h)) {
      hValues.push(h);
    }
  }
  
  if (hValues.length < 3) return null;
  
  const width = Math.max(...hValues) - Math.min(...hValues);
  return { width, hValues };
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    if (s.closes.length > 0) {
      const ret = (bar.close - s.closes[s.closes.length - 1]) / s.closes[s.closes.length - 1];
      capPush(s.returns, ret);
    }
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

export interface StratIter82BParams extends StrategyParams {
  window_size: number;
  q_min: number;
  q_max: number;
  width_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter82BStrategy extends BaseIterStrategy<StratIter82BParams> {
  constructor(params: Partial<StratIter82BParams> = {}) {
    super('strat_iter82_b.params.json', {
      window_size: 50,
      q_min: -2,
      q_max: 2,
      width_threshold: 0.2,
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

    if (shouldSkipPrice(bar.close) || !sr) return;
    if (series.returns.length < this.params.window_size) return;

    const windowReturns = series.returns.slice(-this.params.window_size);
    const spectrum = computeMultifractalSpectrum(windowReturns, this.params.q_min, this.params.q_max);

    if (spectrum === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const narrowSpectrum = spectrum.width < this.params.width_threshold;

    if (nearSupport && stochOversold && narrowSpectrum) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
