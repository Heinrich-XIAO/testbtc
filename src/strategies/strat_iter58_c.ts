import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  kValues: number[];
};

type HurstState = {
  shortH: number;
  midH: number;
  longH: number;
  dispersion: number;
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

function capPush(values: number[], value: number, max = 900): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - m) * (v - m), 0) / values.length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

function hurstExponent(closes: number[], period: number): number | null {
  const safePeriod = Math.max(20, Math.floor(period));
  if (closes.length < safePeriod) return null;
  const slice = closes.slice(-safePeriod);

  const logReturns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] > 0 && slice[i] > 0) {
      logReturns.push(Math.log(slice[i] / slice[i - 1]));
    }
  }
  if (logReturns.length < 12) return null;

  const m = mean(logReturns);
  let cumulative = 0;
  let minCum = Number.POSITIVE_INFINITY;
  let maxCum = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < logReturns.length; i++) {
    cumulative += logReturns[i] - m;
    minCum = Math.min(minCum, cumulative);
    maxCum = Math.max(maxCum, cumulative);
  }

  const range = maxCum - minCum;
  const sigma = stdDev(logReturns);
  if (range <= 1e-10 || sigma <= 1e-10) return null;

  const n = logReturns.length;
  const h = Math.log(range / sigma) / Math.log(n / 2);
  if (!Number.isFinite(h)) return null;
  return clamp(h, 0, 1);
}

export interface StratIter58CParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  stoch_period: number;
  stoch_oversold: number;
  stoch_rebound_delta: number;
  pullback_return_floor: number;
  pullback_lookback: number;
  short_hurst_period: number;
  mid_hurst_period: number;
  long_hurst_period: number;
  persistent_hurst_floor: number;
  max_hurst_dispersion: number;
  min_short_vs_long_spread: number;
  disagreement_spike_threshold: number;
  disagreement_jump_threshold: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter58CStrategy implements Strategy {
  params: StratIter58CParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private prevDispersion: Map<string, number> = new Map();

  constructor(params: Partial<StratIter58CParams> = {}) {
    const saved = loadSavedParams<StratIter58CParams>('strat_iter58_c.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.016,
      stoch_period: 14,
      stoch_oversold: 18,
      stoch_rebound_delta: 3,
      pullback_return_floor: 0.004,
      pullback_lookback: 3,
      short_hurst_period: 24,
      mid_hurst_period: 48,
      long_hurst_period: 96,
      persistent_hurst_floor: 0.56,
      max_hurst_dispersion: 0.11,
      min_short_vs_long_spread: -0.01,
      disagreement_spike_threshold: 0.17,
      disagreement_jump_threshold: 0.05,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter58CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [], kValues: [] });
      this.bars.set(bar.tokenId, 0);
    }

    const s = this.series.get(bar.tokenId)!;
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    if (prevClose && prevClose > 0) {
      capPush(s.returns, (bar.close - prevClose) / prevClose);
    }

    const k = stochasticK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_period)));
    if (k !== null) {
      capPush(s.kValues, k);
    }

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private hurstState(series: TokenSeries): HurstState | null {
    const shortH = hurstExponent(series.closes, this.params.short_hurst_period);
    const midH = hurstExponent(series.closes, this.params.mid_hurst_period);
    const longH = hurstExponent(series.closes, this.params.long_hurst_period);

    if (shortH === null || midH === null || longH === null) return null;
    const dispersion = stdDev([shortH, midH, longH]);
    return { shortH, midH, longH, dispersion };
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;

    const result = ctx.buy(bar.tokenId, size);
    if (!result.success) return false;

    this.entryPrice.set(bar.tokenId, bar.close);
    this.entryBar.set(bar.tokenId, barNum);
    return true;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (shouldSkipPrice(bar.close)) return;

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const hs = this.hurstState(series);
    if (!sr || !hs) return;

    const prevDisp = this.prevDispersion.get(bar.tokenId) ?? hs.dispersion;
    this.prevDispersion.set(bar.tokenId, hs.dispersion);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
      const disagreementSpike = hs.dispersion >= this.params.disagreement_spike_threshold;
      const disagreementJump = hs.dispersion - prevDisp >= this.params.disagreement_jump_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || disagreementSpike || disagreementJump) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (series.kValues.length < 2 || series.returns.length < this.params.pullback_lookback + 1) return;

    const floor = this.params.persistent_hurst_floor;
    const alignedPersistent =
      hs.shortH >= floor &&
      hs.midH >= floor &&
      hs.longH >= floor &&
      hs.dispersion <= this.params.max_hurst_dispersion &&
      hs.shortH - hs.longH >= this.params.min_short_vs_long_spread;

    const prevK = series.kValues[series.kValues.length - 2];
    const currK = series.kValues[series.kValues.length - 1];
    const stochRebound = prevK <= this.params.stoch_oversold && currK >= prevK + this.params.stoch_rebound_delta;

    const pullbackWindow = Math.max(1, Math.floor(this.params.pullback_lookback));
    const pullbackSlice = series.returns.slice(-(pullbackWindow + 1), -1);
    const pullbackDepth = pullbackSlice.length > 0 ? Math.abs(Math.min(...pullbackSlice)) : 0;
    const pullbackSeen = pullbackDepth >= this.params.pullback_return_floor;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);

    if (alignedPersistent && pullbackSeen && stochRebound && nearSupport) {
      this.open(ctx, bar, barNum);
    }
  }
}
