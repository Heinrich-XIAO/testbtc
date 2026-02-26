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

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const sqDiffs = values.map(v => (v - m) ** 2);
  return Math.sqrt(mean(sqDiffs));
}

function fitPowerLawTail(values: number[], minThreshold: number): number | null {
  const tailValues = values.filter(v => v >= minThreshold);
  if (tailValues.length < 5) return null;

  tailValues.sort((a, b) => a - b);
  const n = tailValues.length;
  
  const logRanks: number[] = [];
  const logValues: number[] = [];
  
  for (let i = 0; i < n; i++) {
    const rank = i + 1;
    const ccdfEstimate = (n - i) / n;
    if (ccdfEstimate > 0 && tailValues[i] > 0) {
      logRanks.push(Math.log(1 / ccdfEstimate));
      logValues.push(Math.log(tailValues[i]));
    }
  }
  
  if (logRanks.length < 3) return null;
  
  const nPoints = logRanks.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < nPoints; i++) {
    sumX += logRanks[i];
    sumY += logValues[i];
    sumXY += logRanks[i] * logValues[i];
    sumX2 += logRanks[i] * logRanks[i];
  }
  const denom = nPoints * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (nPoints * sumXY - sumX * sumY) / denom;
  
  return slope;
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

export interface StratIter82DParams extends StrategyParams {
  event_threshold: number;
  window_size: number;
  tail_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter82DStrategy extends BaseIterStrategy<StratIter82DParams> {
  constructor(params: Partial<StratIter82DParams> = {}) {
    super('strat_iter82_d.params.json', {
      event_threshold: 2.0,
      window_size: 50,
      tail_threshold: 3.0,
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
    const absReturns = windowReturns.map(r => Math.abs(r));
    const std = stdDev(windowReturns);
    
    if (std === 0) return;

    const threshold = std * this.params.event_threshold;
    const tailExponent = fitPowerLawTail(absReturns, threshold);
    
    if (tailExponent === null) return;

    const lastAbsReturn = Math.abs(windowReturns[windowReturns.length - 1]);
    const recentLargeEvent = lastAbsReturn >= threshold;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const fatTails = tailExponent < this.params.tail_threshold;

    if (nearSupport && stochOversold && fatTails && recentLargeEvent) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
