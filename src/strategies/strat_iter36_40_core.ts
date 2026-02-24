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

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

function emaNext(prev: number | undefined, value: number, period: number): number {
  const alpha = 2 / (period + 1);
  if (prev === undefined) return value;
  return prev + alpha * (value - prev);
}

function atr(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = highs.length - period; i < highs.length; i++) {
    const prevClose = closes[i - 1];
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - prevClose), Math.abs(lows[i] - prevClose));
    trs.push(tr);
  }
  return trs.reduce((s, v) => s + v, 0) / period;
}

function rsi(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((s, x) => s + (x - m) * (x - m), 0) / values.length;
  return Math.sqrt(v);
}

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 50;
  let below = 0;
  for (const v of values) if (v <= value) below += 1;
  return (below / values.length) * 100;
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

export interface StratIter36AParams extends StrategyParams {
  sr_lookback: number;
  vwap_lookback: number;
  deviation_threshold: number;
  reclaim_buffer: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter36AStrategy extends BaseIterStrategy<StratIter36AParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter36AParams> = {}) {
    super('strat_iter36_a.params.json', {
      sr_lookback: 50,
      vwap_lookback: 24,
      deviation_threshold: 0.03,
      reclaim_buffer: 0.003,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId)!;
      const ebar = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= entry * (1 - this.params.stop_loss) || bar.high >= entry * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - ebar >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || series.closes.length < this.params.vwap_lookback + 2) return;
    const recent = series.closes.slice(-this.params.vwap_lookback);
    const vwap = mean(recent);
    const prevClose = series.closes[series.closes.length - 2];
    const wasDeviated = prevClose < vwap * (1 - this.params.deviation_threshold);
    const reclaimed = bar.close >= vwap * (1 - this.params.reclaim_buffer);
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (wasDeviated && reclaimed && nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter36BParams extends StrategyParams {
  sr_lookback: number;
  ema_fast: number;
  ema_slow: number;
  slope_lookback: number;
  min_slope: number;
  max_slope: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter36BStrategy extends BaseIterStrategy<StratIter36BParams> {
  private emaFast: Map<string, number> = new Map();
  private emaSlow: Map<string, number> = new Map();
  private emaSlowHist: Map<string, number[]> = new Map();
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter36BParams> = {}) {
    super('strat_iter36_b.params.json', {
      sr_lookback: 50,
      ema_fast: 9,
      ema_slow: 34,
      slope_lookback: 6,
      min_slope: -0.002,
      max_slope: 0.01,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.emaSlowHist.has(bar.tokenId)) this.emaSlowHist.set(bar.tokenId, []);
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const ef = emaNext(this.emaFast.get(bar.tokenId), bar.close, this.params.ema_fast);
    const es = emaNext(this.emaSlow.get(bar.tokenId), bar.close, this.params.ema_slow);
    this.emaFast.set(bar.tokenId, ef);
    this.emaSlow.set(bar.tokenId, es);
    capPush(this.emaSlowHist.get(bar.tokenId)!, es);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const slowHist = this.emaSlowHist.get(bar.tokenId)!;
    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || slowHist.length < this.params.slope_lookback + 1) return;
    const slopeRef = slowHist[slowHist.length - 1 - this.params.slope_lookback];
    const slope = slopeRef > 0 ? (es - slopeRef) / slopeRef : 0;
    const slopeGate = slope >= this.params.min_slope && slope <= this.params.max_slope;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (slopeGate && ef >= es && nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter36CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  arm_band: number;
  trigger_band: number;
  disarm_band: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter36CStrategy extends BaseIterStrategy<StratIter36CParams> {
  private kVals: Map<string, number[]> = new Map();
  private armed: Map<string, boolean> = new Map();
  constructor(params: Partial<StratIter36CParams> = {}) {
    super('strat_iter36_c.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      arm_band: 16,
      trigger_band: 24,
      disarm_band: 45,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.armed.has(bar.tokenId)) this.armed.set(bar.tokenId, false);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars || (kv.length > 0 && kv[kv.length - 1] >= this.params.disarm_band)) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const currK = kv[kv.length - 1];
    if (currK <= this.params.arm_band) this.armed.set(bar.tokenId, true);
    const arm = this.armed.get(bar.tokenId)!;
    const nearSupport = bar.low <= sr.support * 1.015;
    if (arm && nearSupport && kv[kv.length - 2] < this.params.trigger_band && currK >= this.params.trigger_band) {
      const opened = this.open(ctx, bar, barNum, this.params.risk_percent);
      if (opened) this.armed.set(bar.tokenId, false);
    }
  }
}

export interface StratIter37AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  atr_period: number;
  atr_mult: number;
  hard_stop: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter37AStrategy extends BaseIterStrategy<StratIter37AParams> {
  private kVals: Map<string, number[]> = new Map();
  private peakSinceEntry: Map<string, number> = new Map();
  constructor(params: Partial<StratIter37AParams> = {}) {
    super('strat_iter37_a.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      atr_period: 14,
      atr_mult: 2.2,
      hard_stop: 0.09,
      profit_target: 0.24,
      max_hold_bars: 36,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const atrVal = atr(series.highs, series.lows, series.closes, this.params.atr_period);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      const peak = Math.max(this.peakSinceEntry.get(bar.tokenId) || e, bar.high);
      this.peakSinceEntry.set(bar.tokenId, peak);
      const atrStop = atrVal !== null ? peak - atrVal * this.params.atr_mult : e * (1 - this.params.hard_stop);
      const hardStop = e * (1 - this.params.hard_stop);
      const stop = Math.max(atrStop, hardStop);
      if (bar.low <= stop || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.985) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
        this.peakSinceEntry.delete(bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (nearSupport && stochRecover) {
      const opened = this.open(ctx, bar, barNum, this.params.risk_percent);
      if (opened) this.peakSinceEntry.set(bar.tokenId, bar.high);
    }
  }
}

export interface StratIter37BParams extends StrategyParams {
  sr_lookback: number;
  support_touch_threshold: number;
  max_touch_age: number;
  age_decay_bars: number;
  weighted_min_score: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter37BStrategy extends BaseIterStrategy<StratIter37BParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter37BParams> = {}) {
    super('strat_iter37_b.params.json', {
      sr_lookback: 50,
      support_touch_threshold: 0.01,
      max_touch_age: 16,
      age_decay_bars: 8,
      weighted_min_score: 0.35,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;

    let latestTouchAge = Number.MAX_SAFE_INTEGER;
    for (let i = 1; i <= Math.min(this.params.max_touch_age, series.lows.length - 1); i++) {
      const low = series.lows[series.lows.length - 1 - i];
      if (Math.abs(low - sr.support) / Math.max(sr.support, 1e-9) <= this.params.support_touch_threshold) {
        latestTouchAge = i;
        break;
      }
    }
    const weightedScore = latestTouchAge === Number.MAX_SAFE_INTEGER ? 0 : Math.exp(-latestTouchAge / Math.max(this.params.age_decay_bars, 1));
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (weightedScore >= this.params.weighted_min_score && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter37CParams extends StrategyParams {
  sr_lookback: number;
  breakout_buffer: number;
  reclaim_buffer: number;
  fail_window: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter37CStrategy extends BaseIterStrategy<StratIter37CParams> {
  private kVals: Map<string, number[]> = new Map();
  private failedBreakdownAt: Map<string, number> = new Map();
  constructor(params: Partial<StratIter37CParams> = {}) {
    super('strat_iter37_c.params.json', {
      sr_lookback: 50,
      breakout_buffer: 0.006,
      reclaim_buffer: 0.004,
      fail_window: 6,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.19,
      max_hold_bars: 30,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr) return;

    if (bar.close < sr.support * (1 - this.params.breakout_buffer)) this.failedBreakdownAt.set(bar.tokenId, barNum);
    const failBar = this.failedBreakdownAt.get(bar.tokenId);
    const validFail = failBar !== undefined && barNum - failBar <= this.params.fail_window;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || bar.high >= sr.resistance * 0.98 || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }

    if (shouldSkipPrice(bar.close) || kv.length < 2 || !validFail) return;
    const reclaimed = bar.close >= sr.support * (1 + this.params.reclaim_buffer);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (reclaimed && stochRecover) {
      const opened = this.open(ctx, bar, barNum, this.params.risk_percent);
      if (opened) this.failedBreakdownAt.delete(bar.tokenId);
    }
  }
}

export interface StratIter38AParams extends StrategyParams {
  sr_lookback: number;
  rsi_period: number;
  rsi_percentile_lookback: number;
  rsi_percentile_entry: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter38AStrategy extends BaseIterStrategy<StratIter38AParams> {
  private rsiVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter38AParams> = {}) {
    super('strat_iter38_a.params.json', {
      sr_lookback: 50,
      rsi_period: 14,
      rsi_percentile_lookback: 80,
      rsi_percentile_entry: 20,
      support_buffer: 0.015,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.rsiVals.has(bar.tokenId)) this.rsiVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const r = rsi(series.closes, this.params.rsi_period);
    if (r !== null) capPush(this.rsiVals.get(bar.tokenId)!, r);
    const rs = this.rsiVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || rs.length < this.params.rsi_percentile_lookback / 2) return;
    const window = rs.slice(-this.params.rsi_percentile_lookback);
    const pr = percentileRank(window, rs[rs.length - 1]);
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    if (pr <= this.params.rsi_percentile_entry && nearSupport) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter38BParams extends StrategyParams {
  donchian_lookback: number;
  revert_band: number;
  sr_lookback: number;
  stop_loss: number;
  midline_take_profit: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter38BStrategy extends BaseIterStrategy<StratIter38BParams> {
  constructor(params: Partial<StratIter38BParams> = {}) {
    super('strat_iter38_b.params.json', {
      donchian_lookback: 28,
      revert_band: 0.12,
      sr_lookback: 50,
      stop_loss: 0.08,
      midline_take_profit: 0.4,
      max_hold_bars: 30,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.highs.length < this.params.donchian_lookback + 1) return;
    const highs = series.highs.slice(-(this.params.donchian_lookback + 1), -1);
    const lows = series.lows.slice(-(this.params.donchian_lookback + 1), -1);
    const dHigh = Math.max(...highs);
    const dLow = Math.min(...lows);
    const dMid = (dHigh + dLow) / 2;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      const toMid = dMid > e ? (dMid - e) / Math.max(e, 1e-9) : 0;
      if (bar.low <= e * (1 - this.params.stop_loss) || toMid >= this.params.midline_take_profit || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close) || dHigh <= dLow) return;
    const channel = dHigh - dLow;
    const nearLower = bar.close <= dLow + channel * this.params.revert_band;
    if (nearLower) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter38CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  confirm_window: number;
  confirm_break_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter38CStrategy extends BaseIterStrategy<StratIter38CParams> {
  private kVals: Map<string, number[]> = new Map();
  private stage1At: Map<string, number> = new Map();
  constructor(params: Partial<StratIter38CParams> = {}) {
    super('strat_iter38_c.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      confirm_window: 5,
      confirm_break_buffer: 0.004,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 30,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || bar.high >= sr.resistance * 0.98 || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }

    if (shouldSkipPrice(bar.close) || kv.length < 2 || series.closes.length < 2) return;
    const stage1 = this.stage1At.get(bar.tokenId);
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (nearSupport && stochRecover) this.stage1At.set(bar.tokenId, barNum);
    const activeStage = stage1 !== undefined && barNum - stage1 <= this.params.confirm_window;
    if (!activeStage) return;
    const prevHigh = series.highs[series.highs.length - 2];
    const confirmBreak = bar.close >= prevHigh * (1 + this.params.confirm_break_buffer);
    if (confirmBreak) {
      const opened = this.open(ctx, bar, barNum, this.params.risk_percent);
      if (opened) this.stage1At.delete(bar.tokenId);
    }
  }
}

export interface StratIter39AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  initial_profit_target: number;
  min_profit_target: number;
  decay_per_bar: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter39AStrategy extends BaseIterStrategy<StratIter39AParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter39AParams> = {}) {
    super('strat_iter39_a.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      initial_profit_target: 0.22,
      min_profit_target: 0.10,
      decay_per_bar: 0.004,
      max_hold_bars: 30,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      const held = barNum - eb;
      const dynamicTarget = Math.max(this.params.min_profit_target, this.params.initial_profit_target - held * this.params.decay_per_bar);
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + dynamicTarget) || (sr && bar.high >= sr.resistance * 0.98) || held >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter39BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  vol_lookback: number;
  min_resistance_threshold: number;
  max_resistance_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter39BStrategy extends BaseIterStrategy<StratIter39BParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter39BParams> = {}) {
    super('strat_iter39_b.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      vol_lookback: 20,
      min_resistance_threshold: 0.95,
      max_resistance_threshold: 0.99,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr) return;
    const rets: number[] = [];
    for (let i = Math.max(1, series.closes.length - this.params.vol_lookback); i < series.closes.length; i++) {
      const prev = series.closes[i - 1];
      const curr = series.closes[i];
      if (prev > 0) rets.push((curr - prev) / prev);
    }
    const vol = stddev(rets);
    const volNorm = Math.max(0, Math.min(1, vol / 0.04));
    const dynResThreshold = this.params.max_resistance_threshold - (this.params.max_resistance_threshold - this.params.min_resistance_threshold) * volNorm;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || bar.high >= sr.resistance * dynResThreshold || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close) || kv.length < 2) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter39CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  cooldown_bars: number;
  risk_percent: number;
}

export class StratIter39CStrategy extends BaseIterStrategy<StratIter39CParams> {
  private kVals: Map<string, number[]> = new Map();
  private cooldownUntil: Map<string, number> = new Map();
  constructor(params: Partial<StratIter39CParams> = {}) {
    super('strat_iter39_c.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      cooldown_bars: 8,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      const stopped = bar.low <= e * (1 - this.params.stop_loss);
      if (stopped || bar.high >= e * (1 + this.params.profit_target) || bar.high >= sr.resistance * 0.98 || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
        if (stopped) this.cooldownUntil.set(bar.tokenId, barNum + this.params.cooldown_bars);
      }
      return;
    }
    if (shouldSkipPrice(bar.close) || kv.length < 2) return;
    if (barNum < (this.cooldownUntil.get(bar.tokenId) || 0)) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter40AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  momentum_lookback: number;
  score_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter40AStrategy extends BaseIterStrategy<StratIter40AParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter40AParams> = {}) {
    super('strat_iter40_a.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      momentum_lookback: 4,
      score_threshold: 3,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || series.closes.length < this.params.momentum_lookback + 1) return;
    const momentum = (bar.close - series.closes[series.closes.length - 1 - this.params.momentum_lookback]) / Math.max(series.closes[series.closes.length - 1 - this.params.momentum_lookback], 1e-9);
    let score = 0;
    if (bar.low <= sr.support * 1.015) score += 1;
    if (kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold) score += 1;
    if (momentum > 0.005) score += 1;
    if (bar.close > series.closes[series.closes.length - 2]) score += 1;
    if (bar.close > (bar.high + bar.low) / 2) score += 1;
    if (score >= this.params.score_threshold) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter40BParams extends StrategyParams {
  sr_lookback: number;
  macd_fast: number;
  macd_slow: number;
  macd_signal: number;
  zero_retest_band: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter40BStrategy extends BaseIterStrategy<StratIter40BParams> {
  private emaFast: Map<string, number> = new Map();
  private emaSlow: Map<string, number> = new Map();
  private emaSignal: Map<string, number> = new Map();
  private macdHist: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter40BParams> = {}) {
    super('strat_iter40_b.params.json', {
      sr_lookback: 50,
      macd_fast: 12,
      macd_slow: 26,
      macd_signal: 9,
      zero_retest_band: 0.01,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.macdHist.has(bar.tokenId)) this.macdHist.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const ef = emaNext(this.emaFast.get(bar.tokenId), bar.close, this.params.macd_fast);
    const es = emaNext(this.emaSlow.get(bar.tokenId), bar.close, this.params.macd_slow);
    this.emaFast.set(bar.tokenId, ef);
    this.emaSlow.set(bar.tokenId, es);
    const macd = ef - es;
    const signal = emaNext(this.emaSignal.get(bar.tokenId), macd, this.params.macd_signal);
    this.emaSignal.set(bar.tokenId, signal);
    capPush(this.macdHist.get(bar.tokenId)!, macd);

    const mh = this.macdHist.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars || macd < signal) this.close(ctx, bar.tokenId);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || mh.length < 3) return;
    const nearZeroRetest = Math.abs(mh[mh.length - 2]) <= this.params.zero_retest_band;
    const crossAboveZero = mh[mh.length - 2] <= 0 && mh[mh.length - 1] > 0;
    const nearSupport = bar.low <= sr.support * 1.02;
    if (nearZeroRetest && crossAboveZero && nearSupport) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter40CParams extends StrategyParams {
  sr_lookback: number;
  range_lookback: number;
  momentum_lookback: number;
  normalized_momentum_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter40CStrategy extends BaseIterStrategy<StratIter40CParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter40CParams> = {}) {
    super('strat_iter40_c.params.json', {
      sr_lookback: 50,
      range_lookback: 24,
      momentum_lookback: 4,
      normalized_momentum_threshold: 0.18,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || series.highs.length < this.params.range_lookback + 1 || series.closes.length < this.params.momentum_lookback + 1) return;
    const high = Math.max(...series.highs.slice(-this.params.range_lookback));
    const low = Math.min(...series.lows.slice(-this.params.range_lookback));
    const range = Math.max(high - low, 1e-6);
    const mom = bar.close - series.closes[series.closes.length - 1 - this.params.momentum_lookback];
    const normMom = mom / range;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (nearSupport && stochRecover && normMom >= this.params.normalized_momentum_threshold) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
