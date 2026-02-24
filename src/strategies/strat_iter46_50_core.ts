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

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((s, x) => s + (x - m) * (x - m), 0) / values.length;
  return Math.sqrt(v);
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
  return mean(trs);
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

export interface StratIter46AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  short_range_window: number;
  long_range_window: number;
  squeeze_ratio_max: number;
  release_range_ratio_min: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter46AStrategy extends BaseIterStrategy<StratIter46AParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter46AParams> = {}) {
    super(
      'strat_iter46_a.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        short_range_window: 6,
        long_range_window: 22,
        squeeze_ratio_max: 0.62,
        release_range_ratio_min: 1.25,
        support_buffer: 0.015,
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
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      return;
    }

    const sw = this.params.short_range_window;
    const lw = this.params.long_range_window;
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || series.highs.length < lw + 2 || sw >= lw) return;
    const shortRanges = series.highs.slice(-sw).map((h, i) => h - series.lows.slice(-sw)[i]);
    const longRanges = series.highs.slice(-lw).map((h, i) => h - series.lows.slice(-lw)[i]);
    const shortAvg = mean(shortRanges);
    const longAvg = mean(longRanges);
    if (longAvg <= 1e-8) return;
    const squeeze = shortAvg / longAvg <= this.params.squeeze_ratio_max;
    const release = (bar.high - bar.low) / Math.max(shortAvg, 1e-8) >= this.params.release_range_ratio_min;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (squeeze && release && nearSupport && stochRecover && bar.close > bar.open) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter46BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_trigger: number;
  exhaustion_window: number;
  min_down_bars: number;
  max_last_drop: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter46BStrategy extends BaseIterStrategy<StratIter46BParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter46BParams> = {}) {
    super(
      'strat_iter46_b.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_trigger: 22,
        exhaustion_window: 6,
        min_down_bars: 3,
        max_last_drop: 0.012,
        support_buffer: 0.016,
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
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0) {
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      return;
    }

    const w = this.params.exhaustion_window;
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || series.closes.length < w + 1) return;
    let downBars = 0;
    for (let i = series.closes.length - w; i < series.closes.length; i++) {
      if (series.closes[i] < series.closes[i - 1]) downBars += 1;
    }
    const prevClose = series.closes[series.closes.length - 2];
    const lastDrop = prevClose > 0 ? Math.max(0, (prevClose - bar.close) / prevClose) : 0;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRelease = kv[kv.length - 2] < this.params.stoch_trigger && kv[kv.length - 1] >= this.params.stoch_trigger;
    if (downBars >= this.params.min_down_bars && lastDrop <= this.params.max_last_drop && nearSupport && stochRelease) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter46CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  wick_body_ratio_min: number;
  reclaim_buffer: number;
  close_location_min: number;
  support_sweep_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter46CStrategy extends BaseIterStrategy<StratIter46CParams> {
  constructor(params: Partial<StratIter46CParams> = {}) {
    super(
      'strat_iter46_c.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        wick_body_ratio_min: 1.5,
        reclaim_buffer: 0.002,
        close_location_min: 0.58,
        support_sweep_buffer: 0.004,
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
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || series.closes.length < 3) return;
    const swept = bar.low <= sr.support * (1 - this.params.support_sweep_buffer);
    const reclaimed = bar.close >= sr.support * (1 + this.params.reclaim_buffer);
    const lowerWick = Math.max(0, Math.min(bar.open, bar.close) - bar.low);
    const body = Math.max(Math.abs(bar.close - bar.open), 1e-6);
    const wickStrong = lowerWick / body >= this.params.wick_body_ratio_min;
    const range = Math.max(bar.high - bar.low, 1e-6);
    const closeLocation = (bar.close - bar.low) / range;
    if (swept && reclaimed && wickStrong && closeLocation >= this.params.close_location_min) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter47AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  ema_period: number;
  slope_flip_min: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter47AStrategy extends BaseIterStrategy<StratIter47AParams> {
  private kVals: Map<string, number[]> = new Map();
  private emaVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter47AParams> = {}) {
    super(
      'strat_iter47_a.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        ema_period: 10,
        slope_flip_min: 0.0005,
        support_buffer: 0.015,
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
    if (!this.emaVals.has(bar.tokenId)) this.emaVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const prevEma = this.emaVals.get(bar.tokenId)!.length > 0 ? this.emaVals.get(bar.tokenId)![this.emaVals.get(bar.tokenId)!.length - 1] : undefined;
    const ema = emaNext(prevEma, bar.close, this.params.ema_period);
    capPush(this.emaVals.get(bar.tokenId)!, ema);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);

    const kv = this.kVals.get(bar.tokenId)!;
    const ev = this.emaVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || ev.length < 3) return;
    const slopeNow = ev[ev.length - 1] - ev[ev.length - 2];
    const slopePrev = ev[ev.length - 2] - ev[ev.length - 3];
    const inflectionUp = slopePrev <= 0 && slopeNow >= this.params.slope_flip_min;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (inflectionUp && nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter47BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  min_velocity: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter47BStrategy extends BaseIterStrategy<StratIter47BParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter47BParams> = {}) {
    super(
      'strat_iter47_b.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        min_velocity: 3,
        support_buffer: 0.015,
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
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 3) return;
    const v0 = kv[kv.length - 1] - kv[kv.length - 2];
    const v1 = kv[kv.length - 2] - kv[kv.length - 3];
    const velocityBurst = v0 >= this.params.min_velocity && v1 <= v0;
    const cross = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    if (velocityBurst && cross && nearSupport) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter47CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_trigger: number;
  dwell_bars: number;
  support_band: number;
  breakout_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter47CStrategy extends BaseIterStrategy<StratIter47CParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter47CParams> = {}) {
    super(
      'strat_iter47_c.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_trigger: 24,
        dwell_bars: 4,
        support_band: 0.015,
        breakout_buffer: 0.002,
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
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      return;
    }

    const db = this.params.dwell_bars;
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 1 || series.closes.length < db + 2) return;
    let dwell = 0;
    for (let i = 1; i <= db; i++) {
      const c = series.closes[series.closes.length - 1 - i];
      if (Math.abs(c - sr.support) / Math.max(sr.support, 1e-9) <= this.params.support_band) dwell += 1;
    }
    const prevHigh = Math.max(...series.highs.slice(-(db + 1), -1));
    const breakout = bar.close >= prevHigh * (1 + this.params.breakout_buffer);
    if (dwell >= db - 1 && breakout && kv[kv.length - 1] >= this.params.stoch_trigger) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter48AParams extends StrategyParams {
  sr_lookback: number;
  shock_window: number;
  shock_pct_rank: number;
  arm_window: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter48AStrategy extends BaseIterStrategy<StratIter48AParams> {
  private armedUntil: Map<string, number> = new Map();
  constructor(params: Partial<StratIter48AParams> = {}) {
    super(
      'strat_iter48_a.params.json',
      {
        sr_lookback: 50,
        shock_window: 24,
        shock_pct_rank: 0.2,
        arm_window: 4,
        support_buffer: 0.018,
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
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      return;
    }
    const w = this.params.shock_window;
    if (!sr || shouldSkipPrice(bar.close) || series.closes.length < w + 2) return;

    const returns: number[] = [];
    for (let i = series.closes.length - w; i < series.closes.length; i++) {
      const prev = series.closes[i - 1];
      const ret = prev > 0 ? (series.closes[i] - prev) / prev : 0;
      returns.push(ret);
    }
    const sorted = [...returns].sort((a, b) => a - b);
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(this.params.shock_pct_rank * (sorted.length - 1))));
    const threshold = sorted[idx];
    const prevClose = series.closes[series.closes.length - 2];
    const currentRet = prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    if (currentRet <= threshold && nearSupport) {
      this.armedUntil.set(bar.tokenId, barNum + this.params.arm_window);
      return;
    }
    const armed = barNum <= (this.armedUntil.get(bar.tokenId) || -1);
    if (!armed) return;
    if (bar.close > prevClose && bar.close > bar.open) {
      const opened = this.open(ctx, bar, barNum, this.params.risk_percent);
      if (opened) this.armedUntil.delete(bar.tokenId);
    }
  }
}

export interface StratIter48BParams extends StrategyParams {
  sr_lookback: number;
  atr_period: number;
  mean_period: number;
  discount_atr_mult: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter48BStrategy extends BaseIterStrategy<StratIter48BParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter48BParams> = {}) {
    super(
      'strat_iter48_b.params.json',
      {
        sr_lookback: 50,
        atr_period: 14,
        mean_period: 20,
        discount_atr_mult: 1.1,
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
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2) return;
    const m = sma(series.closes, this.params.mean_period);
    const a = atr(series.highs, series.lows, series.closes, this.params.atr_period);
    if (m === null || a === null || a <= 1e-8) return;
    const discounted = bar.close <= m - a * this.params.discount_atr_mult;
    const nearSupport = bar.low <= sr.support * 1.02;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (discounted && nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter48CParams extends StrategyParams {
  sr_lookback: number;
  z_lookback: number;
  z_entry: number;
  z_release: number;
  stoch_k_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter48CStrategy extends BaseIterStrategy<StratIter48CParams> {
  private zVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter48CParams> = {}) {
    super(
      'strat_iter48_c.params.json',
      {
        sr_lookback: 50,
        z_lookback: 24,
        z_entry: -1.2,
        z_release: -0.2,
        stoch_k_period: 14,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 30,
        risk_percent: 0.25,
      },
      params
    );
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.zVals.has(bar.tokenId)) this.zVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr || shouldSkipPrice(bar.close) || series.closes.length < this.params.z_lookback + 1) return;

    const window = series.closes.slice(-this.params.z_lookback);
    const m = mean(window);
    const sd = stddev(window);
    if (sd <= 1e-8) return;
    const z = (bar.close - m) / sd;
    capPush(this.zVals.get(bar.tokenId)!, z);
    const zv = this.zVals.get(bar.tokenId)!;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr.resistance);
      return;
    }
    if (zv.length < 2) return;
    const nearSupport = bar.low <= sr.support * 1.02;
    const deep = zv[zv.length - 2] <= this.params.z_entry;
    const release = zv[zv.length - 1] >= this.params.z_release;
    if (nearSupport && deep && release && bar.close > bar.open) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter49AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  cluster_bars: number;
  min_down_closes: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter49AStrategy extends BaseIterStrategy<StratIter49AParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter49AParams> = {}) {
    super(
      'strat_iter49_a.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        cluster_bars: 5,
        min_down_closes: 3,
        support_buffer: 0.016,
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
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      return;
    }
    const cb = this.params.cluster_bars;
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || series.closes.length < cb + 2) return;
    let downCloses = 0;
    for (let i = series.closes.length - cb; i < series.closes.length; i++) {
      if (series.closes[i] < series.closes[i - 1]) downCloses += 1;
    }
    const prevLow = series.lows[series.lows.length - 2];
    const higherLow = bar.low > prevLow;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (downCloses >= this.params.min_down_closes && higherLow && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter49BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  min_profit_target: number;
  max_profit_target: number;
  target_capture_ratio: number;
  stop_loss: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter49BStrategy extends BaseIterStrategy<StratIter49BParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter49BParams> = {}) {
    super(
      'strat_iter49_b.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        min_profit_target: 0.10,
        max_profit_target: 0.22,
        target_capture_ratio: 0.65,
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
      const exitNow =
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + dynamicTarget) ||
        bar.high >= sr.resistance * 0.985 ||
        barNum - eb >= this.params.max_hold_bars;
      if (exitNow) this.close(ctx, bar.tokenId);
      return;
    }

    if (shouldSkipPrice(bar.close) || kv.length < 2) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter49CParams extends StrategyParams {
  short_lookback: number;
  long_lookback: number;
  support_alignment_max: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter49CStrategy extends BaseIterStrategy<StratIter49CParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter49CParams> = {}) {
    super(
      'strat_iter49_c.params.json',
      {
        short_lookback: 24,
        long_lookback: 50,
        support_alignment_max: 0.02,
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
    const srShort = priorSupportResistance(series.highs, series.lows, this.params.short_lookback);
    const srLong = priorSupportResistance(series.highs, series.lows, this.params.long_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, srLong?.resistance ?? srShort?.resistance ?? null);
      return;
    }
    if (!srShort || !srLong || shouldSkipPrice(bar.close) || kv.length < 2) return;
    const supportAlign = Math.abs(srShort.support - srLong.support) / Math.max(srLong.support, 1e-9) <= this.params.support_alignment_max;
    const nearSupport = bar.low <= Math.min(srShort.support, srLong.support) * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (supportAlign && nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter50AParams extends StrategyParams {
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

export class StratIter50AStrategy extends BaseIterStrategy<StratIter50AParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter50AParams> = {}) {
    super(
      'strat_iter50_a.params.json',
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
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr.resistance);
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

export interface StratIter50BParams extends StrategyParams {
  sr_lookback: number;
  narrow_window: number;
  narrow_ratio_max: number;
  body_ratio_min: number;
  stoch_k_period: number;
  stoch_trigger: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter50BStrategy extends BaseIterStrategy<StratIter50BParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter50BParams> = {}) {
    super(
      'strat_iter50_b.params.json',
      {
        sr_lookback: 50,
        narrow_window: 6,
        narrow_ratio_max: 0.75,
        body_ratio_min: 0.55,
        stoch_k_period: 14,
        stoch_trigger: 22,
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
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      return;
    }

    const nw = this.params.narrow_window;
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 1 || series.highs.length < nw + 2) return;
    const recentRanges = series.highs.slice(-nw).map((h, i) => h - series.lows.slice(-nw)[i]);
    const prevRanges = series.highs.slice(-(nw * 2), -nw).map((h, i) => h - series.lows.slice(-(nw * 2), -nw)[i]);
    if (prevRanges.length < nw) return;
    const narrow = mean(recentRanges) / Math.max(mean(prevRanges), 1e-8) <= this.params.narrow_ratio_max;
    const range = Math.max(bar.high - bar.low, 1e-8);
    const bodyRatio = Math.abs(bar.close - bar.open) / range;
    const nearSupport = bar.low <= sr.support * 1.015;
    if (narrow && bodyRatio >= this.params.body_ratio_min && bar.close > bar.open && nearSupport && kv[kv.length - 1] >= this.params.stoch_trigger) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter50CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  pressure_flip_min: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter50CStrategy extends BaseIterStrategy<StratIter50CParams> {
  private kVals: Map<string, number[]> = new Map();
  private pressureVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter50CParams> = {}) {
    super(
      'strat_iter50_c.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        pressure_flip_min: 0.15,
        support_buffer: 0.015,
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
    if (!this.pressureVals.has(bar.tokenId)) this.pressureVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const range = Math.max(bar.high - bar.low, 1e-8);
    const pressure = (bar.close - bar.open) / range;
    capPush(this.pressureVals.get(bar.tokenId)!, pressure);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);

    const pv = this.pressureVals.get(bar.tokenId)!;
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || pv.length < 2) return;
    const pressureFlip = pv[pv.length - 2] <= 0 && pv[pv.length - 1] >= this.params.pressure_flip_min;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (pressureFlip && nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
