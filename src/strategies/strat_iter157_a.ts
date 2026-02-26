import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  shortReturns: number[];
  longReturns: number[];
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

function pearsonCorrelation(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 5) return null;
  const n = a.length;
  const meanA = a.reduce((sum, v) => sum + v, 0) / n;
  const meanB = b.reduce((sum, v) => sum + v, 0) / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < n; i++) {
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

function rollingAutocorrelation(returns: number[], window: number, lag: number): number | null {
  const w = Math.max(6, Math.floor(window));
  const l = Math.max(1, Math.floor(lag));
  if (returns.length < w + l) return null;

  const segment = returns.slice(-(w + l));
  const a = segment.slice(0, w);
  const b = segment.slice(l, l + w);
  return pearsonCorrelation(a, b);
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
        returns: [],
        shortReturns: [],
        longReturns: [],
      });
      this.bars.set(bar.tokenId, 0);
    }

    const s = this.series.get(bar.tokenId)!;
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    if (prevClose !== null && prevClose > 0) {
      capPush(s.returns, bar.close / prevClose - 1);
    }

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

export interface StratIter157AParams extends StrategyParams {
  autocorr_window: number;
  autocorr_threshold: number;
  corr_window: number;
  short_horizon: number;
  long_horizon: number;
  regime_corr_threshold: number;
  pullback_threshold: number;
  stoch_oversold: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter157AStrategy extends BaseIterStrategy<StratIter157AParams> {
  constructor(params: Partial<StratIter157AParams> = {}) {
    super('strat_iter157_a.params.json', {
      autocorr_window: 24,
      autocorr_threshold: -0.05,
      corr_window: 20,
      short_horizon: 2,
      long_horizon: 8,
      regime_corr_threshold: 0.15,
      pullback_threshold: -0.01,
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
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close)) return;

    const shortH = Math.max(1, Math.floor(this.params.short_horizon));
    const longH = Math.max(shortH + 1, Math.floor(this.params.long_horizon));

    if (series.closes.length > shortH) {
      const shortRet = bar.close / series.closes[series.closes.length - 1 - shortH] - 1;
      capPush(series.shortReturns, shortRet);
    }

    if (series.closes.length > longH) {
      const longRet = bar.close / series.closes[series.closes.length - 1 - longH] - 1;
      capPush(series.longReturns, longRet);
    }

    const k = stochK(series.closes, series.highs, series.lows, 14);
    const ac = rollingAutocorrelation(series.returns, this.params.autocorr_window, 1);
    const horizonCorr = rollingCorrelation(series.shortReturns, series.longReturns, this.params.corr_window);

    if (k === null || ac === null || horizonCorr === null) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochOversold = k < this.params.stoch_oversold;

    const lastShort = series.shortReturns.length > 0 ? series.shortReturns[series.shortReturns.length - 1] : 0;
    const pullback = lastShort <= this.params.pullback_threshold;

    const meanRevertingRegime =
      ac <= this.params.autocorr_threshold &&
      horizonCorr <= this.params.regime_corr_threshold;

    if (meanRevertingRegime && pullback && stochOversold && nearSupport) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
