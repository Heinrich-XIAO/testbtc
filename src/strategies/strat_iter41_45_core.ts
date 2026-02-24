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

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((s, x) => s + (x - m) * (x - m), 0) / values.length;
  return Math.sqrt(v);
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

export interface StratIter41AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  compression_window: number;
  compression_ratio_max: number;
  support_buffer: number;
  breakout_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter41AStrategy extends BaseIterStrategy<StratIter41AParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter41AParams> = {}) {
    super(
      'strat_iter41_a.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        compression_window: 5,
        compression_ratio_max: 0.75,
        support_buffer: 0.015,
        breakout_buffer: 0.003,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
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
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const cw = this.params.compression_window;
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || series.highs.length < cw * 2 + 2) return;
    const recentRange = mean(series.highs.slice(-cw).map((h, i) => h - series.lows.slice(-cw)[i]));
    const prevHighs = series.highs.slice(-(cw * 2), -cw);
    const prevLows = series.lows.slice(-(cw * 2), -cw);
    const prevRange = mean(prevHighs.map((h, i) => h - prevLows[i]));
    if (prevRange <= 0) return;
    const compressed = recentRange / prevRange <= this.params.compression_ratio_max;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const prevHigh = series.highs[series.highs.length - 2];
    const breakout = bar.close >= prevHigh * (1 + this.params.breakout_buffer);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;

    if (compressed && nearSupport && breakout && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter41BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  sweep_buffer: number;
  reclaim_buffer: number;
  min_wick_to_body: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter41BStrategy extends BaseIterStrategy<StratIter41BParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter41BParams> = {}) {
    super(
      'strat_iter41_b.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        sweep_buffer: 0.004,
        reclaim_buffer: 0.003,
        min_wick_to_body: 1.8,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
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
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2) return;
    const swept = bar.low <= sr.support * (1 - this.params.sweep_buffer);
    const reclaimed = bar.close >= sr.support * (1 + this.params.reclaim_buffer);
    const lowerWick = Math.max(0, Math.min(bar.open, bar.close) - bar.low);
    const body = Math.max(Math.abs(bar.close - bar.open), 1e-6);
    const wickStrong = lowerWick / body >= this.params.min_wick_to_body;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (swept && reclaimed && wickStrong && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter41CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  momentum_lookback: number;
  min_profit_target: number;
  max_profit_target: number;
  target_capture_ratio: number;
  stop_loss: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter41CStrategy extends BaseIterStrategy<StratIter41CParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter41CParams> = {}) {
    super(
      'strat_iter41_c.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        momentum_lookback: 4,
        min_profit_target: 0.10,
        max_profit_target: 0.22,
        target_capture_ratio: 0.7,
        stop_loss: 0.08,
        max_hold_bars: 30,
        risk_percent: 0.25,
      },
      params
    );
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
      const distanceToResistance = Math.max(0, (sr.resistance - e) / Math.max(e, 1e-9));
      const dynamicTarget = Math.max(
        this.params.min_profit_target,
        Math.min(this.params.max_profit_target, distanceToResistance * this.params.target_capture_ratio)
      );
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + dynamicTarget) ||
        bar.high >= sr.resistance * 0.985 ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || kv.length < 2 || series.closes.length < this.params.momentum_lookback + 1) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const past = series.closes[series.closes.length - 1 - this.params.momentum_lookback];
    const mom = (bar.close - past) / Math.max(past, 1e-9);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (nearSupport && stochRecover && mom > 0.003) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter42AParams extends StrategyParams {
  sr_lookback: number;
  support_shift: number;
  min_support_lift: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter42AStrategy extends BaseIterStrategy<StratIter42AParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter42AParams> = {}) {
    super(
      'strat_iter42_a.params.json',
      {
        sr_lookback: 50,
        support_shift: 20,
        min_support_lift: 0.002,
        stoch_k_period: 14,
        stoch_oversold: 18,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const shift = this.params.support_shift;
    let oldSupport: number | null = null;
    if (series.lows.length >= this.params.sr_lookback + shift + 1) {
      const end = series.lows.length - 1 - shift;
      const start = Math.max(0, end - this.params.sr_lookback);
      oldSupport = Math.min(...series.lows.slice(start, end));
    }

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || oldSupport === null || shouldSkipPrice(bar.close) || kv.length < 2) return;
    const risingSupport = sr.support >= oldSupport * (1 + this.params.min_support_lift);
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (risingSupport && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter42BParams extends StrategyParams {
  sr_lookback: number;
  z_lookback: number;
  z_entry_threshold: number;
  hold_window: number;
  min_support_holds: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter42BStrategy extends BaseIterStrategy<StratIter42BParams> {
  constructor(params: Partial<StratIter42BParams> = {}) {
    super(
      'strat_iter42_b.params.json',
      {
        sr_lookback: 50,
        z_lookback: 24,
        z_entry_threshold: -1.2,
        hold_window: 12,
        min_support_holds: 2,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || series.closes.length < this.params.z_lookback + 1) return;
    const window = series.closes.slice(-this.params.z_lookback);
    const m = mean(window);
    const sd = stddev(window);
    if (sd <= 1e-6) return;
    const z = (bar.close - m) / sd;

    let supportHolds = 0;
    for (let i = 1; i <= Math.min(this.params.hold_window, series.lows.length - 1); i++) {
      const low = series.lows[series.lows.length - 1 - i];
      if (low <= sr.support * 1.012) supportHolds += 1;
    }
    const bounceBar = bar.close > series.closes[series.closes.length - 2];
    if (z <= this.params.z_entry_threshold && supportHolds >= this.params.min_support_holds && bounceBar) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter42CParams extends StrategyParams {
  sr_lookback: number;
  ema_period: number;
  breakout_lookback: number;
  pullback_buffer: number;
  stoch_k_period: number;
  stoch_trigger: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter42CStrategy extends BaseIterStrategy<StratIter42CParams> {
  private emaMap: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter42CParams> = {}) {
    super(
      'strat_iter42_c.params.json',
      {
        sr_lookback: 50,
        ema_period: 13,
        breakout_lookback: 6,
        pullback_buffer: 0.004,
        stoch_k_period: 14,
        stoch_trigger: 24,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 30,
        risk_percent: 0.25,
      },
      params
    );
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const ema = emaNext(this.emaMap.get(bar.tokenId), bar.close, this.params.ema_period);
    this.emaMap.set(bar.tokenId, ema);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || series.highs.length < this.params.breakout_lookback + 2) return;
    const priorHigh = Math.max(...series.highs.slice(-(this.params.breakout_lookback + 1), -1));
    const breakout = series.closes[series.closes.length - 2] > priorHigh;
    const pullback = bar.low <= ema * (1 + this.params.pullback_buffer);
    const supportAligned = bar.low <= sr.support * 1.02;
    const release = kv[kv.length - 1] >= this.params.stoch_trigger && kv[kv.length - 1] >= kv[kv.length - 2];
    if (breakout && pullback && supportAligned && release && bar.close > ema) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter43AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  atr_short: number;
  atr_long: number;
  expansion_ratio: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter43AStrategy extends BaseIterStrategy<StratIter43AParams> {
  private kVals: Map<string, number[]> = new Map();
  private ratioHist: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter43AParams> = {}) {
    super(
      'strat_iter43_a.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        atr_short: 6,
        atr_long: 20,
        expansion_ratio: 1.12,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.ratioHist.has(bar.tokenId)) this.ratioHist.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const atrS = atr(series.highs, series.lows, series.closes, this.params.atr_short);
    const atrL = atr(series.highs, series.lows, series.closes, this.params.atr_long);
    if (atrS !== null && atrL !== null && atrL > 0) {
      capPush(this.ratioHist.get(bar.tokenId)!, atrS / atrL);
    }
    const rh = this.ratioHist.get(bar.tokenId)!;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || rh.length < 2) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const expansionNow = rh[rh.length - 1] >= this.params.expansion_ratio;
    const expansionRising = rh[rh.length - 1] > rh[rh.length - 2];
    if (nearSupport && stochRecover && expansionNow && expansionRising) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter43BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  divergence_window: number;
  min_price_break: number;
  min_stoch_lift: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter43BStrategy extends BaseIterStrategy<StratIter43BParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter43BParams> = {}) {
    super(
      'strat_iter43_b.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        divergence_window: 8,
        min_price_break: 0.004,
        min_stoch_lift: 4,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
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
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const w = this.params.divergence_window;
    if (!sr || shouldSkipPrice(bar.close) || kv.length < w + 2 || series.lows.length < w + 2) return;
    const prevPriceWindow = series.lows.slice(-(w + 2), -2);
    const prevStochWindow = kv.slice(-(w + 2), -2);
    const prevLow = Math.min(...prevPriceWindow);
    const prevStochLow = Math.min(...prevStochWindow);
    const priceBreak = bar.low <= prevLow * (1 - this.params.min_price_break);
    const stochHigherLow = kv[kv.length - 1] >= prevStochLow + this.params.min_stoch_lift;
    const nearSupport = bar.low <= sr.support * 1.02;
    if (priceBreak && stochHigherLow && nearSupport && bar.close > bar.open) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter43CParams extends StrategyParams {
  sr_lookback: number;
  min_under_bars: number;
  max_under_bars: number;
  reclaim_buffer: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter43CStrategy extends BaseIterStrategy<StratIter43CParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter43CParams> = {}) {
    super(
      'strat_iter43_c.params.json',
      {
        sr_lookback: 50,
        min_under_bars: 1,
        max_under_bars: 5,
        reclaim_buffer: 0.003,
        stoch_k_period: 14,
        stoch_oversold: 18,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 30,
        risk_percent: 0.25,
      },
      params
    );
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
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        bar.high >= sr.resistance * 0.98 ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || kv.length < 2 || series.closes.length < this.params.max_under_bars + 2) return;
    let underBars = 0;
    for (let i = 1; i <= this.params.max_under_bars; i++) {
      const c = series.closes[series.closes.length - 1 - i];
      if (c < sr.support) underBars += 1;
      else break;
    }
    const reclaimed = bar.close >= sr.support * (1 + this.params.reclaim_buffer);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (underBars >= this.params.min_under_bars && underBars <= this.params.max_under_bars && reclaimed && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter44AParams extends StrategyParams {
  sr_lookback: number;
  range_lookback: number;
  low_vol_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  breakout_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter44AStrategy extends BaseIterStrategy<StratIter44AParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter44AParams> = {}) {
    super(
      'strat_iter44_a.params.json',
      {
        sr_lookback: 50,
        range_lookback: 20,
        low_vol_threshold: 0.08,
        stoch_k_period: 14,
        stoch_oversold: 18,
        breakout_buffer: 0.004,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
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
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || series.highs.length < this.params.range_lookback + 2) return;
    const high = Math.max(...series.highs.slice(-this.params.range_lookback));
    const low = Math.min(...series.lows.slice(-this.params.range_lookback));
    const regimeRange = (high - low) / Math.max(bar.close, 1e-9);
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;

    let enter = false;
    if (regimeRange <= this.params.low_vol_threshold) {
      enter = nearSupport && stochRecover;
    } else {
      const prevHigh = series.highs[series.highs.length - 2];
      const breakout = bar.close >= prevHigh * (1 + this.params.breakout_buffer);
      enter = nearSupport && breakout;
    }

    if (enter) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter44BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  cooldown_base: number;
  cooldown_step: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter44BStrategy extends BaseIterStrategy<StratIter44BParams> {
  private kVals: Map<string, number[]> = new Map();
  private lossStreak: Map<string, number> = new Map();
  private cooldownUntil: Map<string, number> = new Map();
  constructor(params: Partial<StratIter44BParams> = {}) {
    super(
      'strat_iter44_b.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        cooldown_base: 2,
        cooldown_step: 3,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.lossStreak.has(bar.tokenId)) this.lossStreak.set(bar.tokenId, 0);
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
      const takeProfit = bar.high >= e * (1 + this.params.profit_target);
      const timedOut = barNum - eb >= this.params.max_hold_bars;
      const atResistance = bar.high >= sr.resistance * 0.98;
      if (stopped || takeProfit || timedOut || atResistance) {
        this.close(ctx, bar.tokenId);
        const prevStreak = this.lossStreak.get(bar.tokenId) || 0;
        if (stopped) {
          const nextStreak = prevStreak + 1;
          this.lossStreak.set(bar.tokenId, nextStreak);
          this.cooldownUntil.set(bar.tokenId, barNum + this.params.cooldown_base + nextStreak * this.params.cooldown_step);
        } else {
          this.lossStreak.set(bar.tokenId, 0);
        }
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

export interface StratIter44CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  initial_stop: number;
  floor_stop: number;
  stop_half_life_bars: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter44CStrategy extends BaseIterStrategy<StratIter44CParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter44CParams> = {}) {
    super(
      'strat_iter44_c.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        initial_stop: 0.10,
        floor_stop: 0.04,
        stop_half_life_bars: 10,
        profit_target: 0.18,
        max_hold_bars: 30,
        risk_percent: 0.25,
      },
      params
    );
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
      const decay = Math.pow(0.5, held / Math.max(this.params.stop_half_life_bars, 1));
      const dynamicStop = Math.max(this.params.floor_stop, this.params.initial_stop * decay);
      if (
        bar.low <= e * (1 - dynamicStop) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        held >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter45AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  chop_lookback: number;
  min_chop_ratio: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter45AStrategy extends BaseIterStrategy<StratIter45AParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter45AParams> = {}) {
    super(
      'strat_iter45_a.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        chop_lookback: 12,
        min_chop_ratio: 0.55,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
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
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const cl = series.closes;
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || cl.length < this.params.chop_lookback + 1) return;
    let signChanges = 0;
    let prevSign = 0;
    for (let i = cl.length - this.params.chop_lookback; i < cl.length; i++) {
      const d = cl[i] - cl[i - 1];
      const sign = d > 0 ? 1 : d < 0 ? -1 : 0;
      if (sign !== 0 && prevSign !== 0 && sign !== prevSign) signChanges += 1;
      if (sign !== 0) prevSign = sign;
    }
    const chopRatio = signChanges / Math.max(this.params.chop_lookback - 1, 1);
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (chopRatio >= this.params.min_chop_ratio && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter45BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  persistence_bars: number;
  oversold_band: number;
  release_band: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter45BStrategy extends BaseIterStrategy<StratIter45BParams> {
  private kVals: Map<string, number[]> = new Map();
  private armed: Map<string, boolean> = new Map();
  constructor(params: Partial<StratIter45BParams> = {}) {
    super(
      'strat_iter45_b.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        persistence_bars: 3,
        oversold_band: 16,
        release_band: 24,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
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
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || kv.length < this.params.persistence_bars + 1) return;
    let persistent = true;
    for (let i = 1; i <= this.params.persistence_bars; i++) {
      if (kv[kv.length - i] > this.params.oversold_band) {
        persistent = false;
        break;
      }
    }
    if (persistent) this.armed.set(bar.tokenId, true);

    const nearSupport = bar.low <= sr.support * 1.015;
    const released = kv[kv.length - 2] < this.params.release_band && kv[kv.length - 1] >= this.params.release_band;
    if (this.armed.get(bar.tokenId) && nearSupport && released) {
      const opened = this.open(ctx, bar, barNum, this.params.risk_percent);
      if (opened) this.armed.set(bar.tokenId, false);
    }
  }
}

export interface StratIter45CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  shock_threshold: number;
  setup_window: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter45CStrategy extends BaseIterStrategy<StratIter45CParams> {
  private kVals: Map<string, number[]> = new Map();
  private armedUntil: Map<string, number> = new Map();
  constructor(params: Partial<StratIter45CParams> = {}) {
    super(
      'strat_iter45_c.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        shock_threshold: 0.03,
        setup_window: 4,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
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
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        bar.high >= sr.resistance * 0.98 ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || kv.length < 2 || series.closes.length < 2) return;
    const prevClose = series.closes[series.closes.length - 2];
    const drop = prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;
    const nearSupport = bar.low <= sr.support * 1.02;
    if (drop <= -this.params.shock_threshold && nearSupport) {
      this.armedUntil.set(bar.tokenId, barNum + this.params.setup_window);
      return;
    }

    const armed = barNum <= (this.armedUntil.get(bar.tokenId) || -1);
    if (!armed || series.highs.length < 2 || series.lows.length < 2) return;
    const prevHigh = series.highs[series.highs.length - 2];
    const prevLow = series.lows[series.lows.length - 2];
    const insideBar = bar.high < prevHigh && bar.low > prevLow;
    const bullish = bar.close > bar.open;
    const stochUp = kv[kv.length - 1] > kv[kv.length - 2];
    if (insideBar && bullish && stochUp) {
      const opened = this.open(ctx, bar, barNum, this.params.risk_percent);
      if (opened) this.armedUntil.delete(bar.tokenId);
    }
  }
}
