import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  shortRawMoves: number[];
  longRawMoves: number[];
  shortNormMoves: number[];
  longNormMoves: number[];
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
  const high = Math.max(...highs.slice(-period));
  const low = Math.min(...lows.slice(-period));
  if (high === low) return 50;
  return ((closes[closes.length - 1] - low) / (high - low)) * 100;
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
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => {
    const delta = value - avg;
    return sum + delta * delta;
  }, 0) / values.length;
  return Math.sqrt(variance);
}

function pearsonCorrelation(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 5) return null;
  const meanA = mean(a);
  const meanB = mean(b);

  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return null;
  return cov / denom;
}

function rollingCorrelation(a: number[], b: number[], window: number): number | null {
  const w = Math.max(6, Math.floor(window));
  if (a.length < w || b.length < w) return null;
  return pearsonCorrelation(a.slice(-w), b.slice(-w));
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
      this.series.set(bar.tokenId, {
        closes: [],
        highs: [],
        lows: [],
        shortRawMoves: [],
        longRawMoves: [],
        shortNormMoves: [],
        longNormMoves: [],
      });
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

export interface StratIter157DParams extends StrategyParams {
  short_horizon: number;
  long_horizon: number;
  norm_window: number;
  corr_window: number;
  dislocation_corr_threshold: number;
  stoch_oversold: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter157DStrategy extends BaseIterStrategy<StratIter157DParams> {
  constructor(params: Partial<StratIter157DParams> = {}) {
    super('strat_iter157_d.params.json', {
      short_horizon: 2,
      long_horizon: 9,
      norm_window: 20,
      corr_window: 20,
      dislocation_corr_threshold: 0,
      stoch_oversold: 18,
      support_buffer: 0.015,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId)!;
      const entryBar = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= entry * (1 - this.params.stop_loss) ||
        bar.high >= entry * (1 + this.params.profit_target) ||
        barNum - entryBar >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr || shouldSkipPrice(bar.close)) return;

    const shortH = Math.max(1, Math.floor(this.params.short_horizon));
    const longH = Math.max(shortH + 1, Math.floor(this.params.long_horizon));
    const normWindow = Math.max(8, Math.floor(this.params.norm_window));

    if (series.closes.length > shortH) {
      const shortMove = bar.close / series.closes[series.closes.length - 1 - shortH] - 1;
      capPush(series.shortRawMoves, shortMove);
    }

    if (series.closes.length > longH) {
      const longMove = bar.close / series.closes[series.closes.length - 1 - longH] - 1;
      capPush(series.longRawMoves, longMove);
    }

    if (series.shortRawMoves.length >= normWindow && series.longRawMoves.length >= normWindow) {
      const shortRecent = series.shortRawMoves.slice(-normWindow);
      const longRecent = series.longRawMoves.slice(-normWindow);
      const shortStd = stdDev(shortRecent);
      const longStd = stdDev(longRecent);

      const shortNow = series.shortRawMoves[series.shortRawMoves.length - 1];
      const longNow = series.longRawMoves[series.longRawMoves.length - 1];

      const shortNorm = shortStd > 1e-6 ? shortNow / shortStd : 0;
      const longNorm = longStd > 1e-6 ? longNow / longStd : 0;

      capPush(series.shortNormMoves, shortNorm);
      capPush(series.longNormMoves, longNorm);
    }

    const k = stochK(series.closes, series.highs, series.lows, 14);
    const corr = rollingCorrelation(series.shortNormMoves, series.longNormMoves, this.params.corr_window);
    if (k === null || corr === null) return;

    const crossScaleDislocation = corr <= this.params.dislocation_corr_threshold;
    const stochOversold = k < this.params.stoch_oversold;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);

    if (crossScaleDislocation && stochOversold && nearSupport) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
