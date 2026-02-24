import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
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

function capPush(values: number[], value: number, max = 700): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);
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

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, x) => s + (x - m) * (x - m), 0) / values.length);
}

function computeHurstExponent(prices: number[]): number | null {
  if (prices.length < 20) return null;
  const logReturns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0 && prices[i] > 0) {
      logReturns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  if (logReturns.length < 10) return null;
  const n = logReturns.length;
  const m = mean(logReturns);
  const cumDev: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += logReturns[i] - m;
    cumDev.push(sum);
  }
  const R = Math.max(...cumDev) - Math.min(...cumDev);
  const S = stdDev(logReturns);
  if (S < 1e-10 || R < 1e-10) return null;
  const RS = R / S;
  const H = Math.log(RS) / Math.log(n / 2);
  return Math.max(0, Math.min(1, H));
}

function barEfficiency(closes: number[], highs: number[], lows: number[], lookback: number): number | null {
  if (closes.length < lookback || highs.length < lookback || lows.length < lookback) return null;
  let totalMove = 0;
  let totalRange = 0;
  for (let i = closes.length - lookback; i < closes.length; i++) {
    const range = highs[i] - lows[i];
    const move = Math.abs(closes[i] - (i > 0 ? closes[i - 1] : closes[i]));
    totalMove += move;
    totalRange += range;
  }
  if (totalRange <= 1e-10) return null;
  return totalMove / totalRange;
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], opens: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.opens, bar.open);
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

  protected baseExit(
    ctx: BacktestContext,
    bar: Bar,
    barNum: number,
    stopLoss: number,
    profitTarget: number,
    maxHoldBars: number,
    resistance: number | null
  ): boolean {
    const e = this.entryPrice.get(bar.tokenId)!;
    const eb = this.entryBar.get(bar.tokenId)!;
    const exitNow =
      bar.low <= e * (1 - stopLoss) ||
      bar.high >= e * (1 + profitTarget) ||
      (resistance !== null && bar.high >= resistance * 0.98) ||
      barNum - eb >= maxHoldBars;
    if (exitNow) this.close(ctx, bar.tokenId);
    return exitNow;
  }

  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter52AParams extends StrategyParams {
  sr_lookback: number;
  hurst_period: number;
  hurst_trending_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter52AStrategy extends BaseIterStrategy<StratIter52AParams> {
  private entryHurst: Map<string, number> = new Map();
  constructor(params: Partial<StratIter52AParams> = {}) {
    super(
      'strat_iter52_a.params.json',
      {
        sr_lookback: 50,
        hurst_period: 50,
        hurst_trending_threshold: 0.5,
        stoch_k_period: 14,
        stoch_oversold: 18,
        support_buffer: 0.015,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
  }

  protected openWithHurst(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number, hurst: number): boolean {
    const result = this.open(ctx, bar, barNum, riskPercent);
    if (result) {
      this.entryHurst.set(bar.tokenId, hurst);
    }
    return result;
  }

  protected closeAll(ctx: BacktestContext, tokenId: string): void {
    this.close(ctx, tokenId);
    this.entryHurst.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      const prices = series.closes.slice(-this.params.hurst_period);
      const currentHurst = computeHurstExponent(prices);
      const exitNow =
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr !== null && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars ||
        (currentHurst !== null && currentHurst < this.params.hurst_trending_threshold);
      if (exitNow) this.closeAll(ctx, bar.tokenId);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close)) return;
    if (series.closes.length < this.params.hurst_period) return;
    const prices = series.closes.slice(-this.params.hurst_period);
    const hurst = computeHurstExponent(prices);
    if (hurst === null) return;
    if (hurst <= this.params.hurst_trending_threshold) return;
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k === null || k > this.params.stoch_oversold) return;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    if (!nearSupport) return;
    this.openWithHurst(ctx, bar, barNum, this.params.risk_percent, hurst);
  }
}

export interface StratIter52BParams extends StrategyParams {
  sr_lookback: number;
  stoch_short_period: number;
  stoch_medium_period: number;
  stoch_long_period: number;
  stoch_oversold: number;
  stoch_exit_threshold: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter52BStrategy extends BaseIterStrategy<StratIter52BParams> {
  private kShort: Map<string, number[]> = new Map();
  private kMedium: Map<string, number[]> = new Map();
  private kLong: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter52BParams> = {}) {
    super(
      'strat_iter52_b.params.json',
      {
        sr_lookback: 50,
        stoch_short_period: 7,
        stoch_medium_period: 14,
        stoch_long_period: 28,
        stoch_oversold: 18,
        stoch_exit_threshold: 35,
        support_buffer: 0.015,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
  }

  private quantumWeight(k: number, threshold: number): number {
    if (k >= threshold) return 0;
    return Math.pow((threshold - k) / threshold, 2);
  }

  private quantumCollapseProbability(kShort: number, kMedium: number, kLong: number, threshold: number): number {
    const wShort = this.quantumWeight(kShort, threshold);
    const wMedium = this.quantumWeight(kMedium, threshold);
    const wLong = this.quantumWeight(kLong, threshold);
    return (wShort * wMedium * wLong) * 3;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kShort.has(bar.tokenId)) this.kShort.set(bar.tokenId, []);
    if (!this.kMedium.has(bar.tokenId)) this.kMedium.set(bar.tokenId, []);
    if (!this.kLong.has(bar.tokenId)) this.kLong.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const kS = stochK(series.closes, series.highs, series.lows, this.params.stoch_short_period);
    const kM = stochK(series.closes, series.highs, series.lows, this.params.stoch_medium_period);
    const kL = stochK(series.closes, series.highs, series.lows, this.params.stoch_long_period);
    if (kS !== null) capPush(this.kShort.get(bar.tokenId)!, kS);
    if (kM !== null) capPush(this.kMedium.get(bar.tokenId)!, kM);
    if (kL !== null) capPush(this.kLong.get(bar.tokenId)!, kL);
    const kShortVals = this.kShort.get(bar.tokenId)!;
    const kMediumVals = this.kMedium.get(bar.tokenId)!;
    const kLongVals = this.kLong.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      let shouldExit = false;
      if (bar.low <= e * (1 - this.params.stop_loss)) shouldExit = true;
      if (bar.high >= e * (1 + this.params.profit_target)) shouldExit = true;
      if (sr && bar.high >= sr.resistance * 0.98) shouldExit = true;
      if (barNum - eb >= this.params.max_hold_bars) shouldExit = true;
      if (kS !== null && kS > this.params.stoch_exit_threshold) shouldExit = true;
      if (kM !== null && kM > this.params.stoch_exit_threshold) shouldExit = true;
      if (kL !== null && kL > this.params.stoch_exit_threshold) shouldExit = true;
      if (shouldExit) this.close(ctx, bar.tokenId);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close)) return;
    if (kShortVals.length < 2 || kMediumVals.length < 2 || kLongVals.length < 2) return;
    const kSNow = kShortVals[kShortVals.length - 1];
    const kMNow = kMediumVals[kMediumVals.length - 1];
    const kLNow = kLongVals[kLongVals.length - 1];
    const kSPrev = kShortVals[kShortVals.length - 2];
    const kMPrev = kMediumVals[kMediumVals.length - 2];
    const kLPrev = kLongVals[kLongVals.length - 2];
    const allOversold = kSNow < this.params.stoch_oversold && 
                        kMNow < this.params.stoch_oversold && 
                        kLNow < this.params.stoch_oversold;
    const anyRecovering = (kSPrev < this.params.stoch_oversold && kSNow >= kSPrev) ||
                          (kMPrev < this.params.stoch_oversold && kMNow >= kMPrev) ||
                          (kLPrev < this.params.stoch_oversold && kLNow >= kLPrev);
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const collapseProb = this.quantumCollapseProbability(kSNow, kMNow, kLNow, this.params.stoch_oversold);
    const strongSignal = collapseProb > 0.5;
    if (allOversold && anyRecovering && nearSupport && strongSignal) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
