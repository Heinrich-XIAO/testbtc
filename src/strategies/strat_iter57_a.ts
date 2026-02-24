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

function capPush(values: number[], value: number, max = 900): void {
  values.push(value);
  if (values.length > max) values.shift();
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

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

function quantize(value: number, minValue: number, maxValue: number, bins: number): number {
  if (bins <= 1 || maxValue <= minValue) return 0;
  const normalized = (value - minValue) / (maxValue - minValue);
  const idx = Math.floor(normalized * bins);
  if (idx < 0) return 0;
  if (idx >= bins) return bins - 1;
  return idx;
}

function mutualInformationProxy(returns: number[], window: number, lag: number, bins: number): number | null {
  const safeWindow = Math.max(16, Math.floor(window));
  const safeLag = Math.max(1, Math.floor(lag));
  const safeBins = Math.max(3, Math.floor(bins));
  if (returns.length < safeWindow + safeLag) return null;

  const sample = returns.slice(-(safeWindow + safeLag));
  const x: number[] = [];
  const y: number[] = [];
  for (let i = safeLag; i < sample.length; i++) {
    x.push(sample[i]);
    y.push(sample[i - safeLag]);
  }

  const n = x.length;
  if (n < 12) return null;

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < n; i++) {
    if (x[i] < minX) minX = x[i];
    if (x[i] > maxX) maxX = x[i];
    if (y[i] < minY) minY = y[i];
    if (y[i] > maxY) maxY = y[i];
  }

  const xCounts = new Array(safeBins).fill(0);
  const yCounts = new Array(safeBins).fill(0);
  const jointCounts = new Array(safeBins * safeBins).fill(0);

  for (let i = 0; i < n; i++) {
    const xb = quantize(x[i], minX, maxX, safeBins);
    const yb = quantize(y[i], minY, maxY, safeBins);
    xCounts[xb] += 1;
    yCounts[yb] += 1;
    jointCounts[xb * safeBins + yb] += 1;
  }

  let mi = 0;
  for (let xi = 0; xi < safeBins; xi++) {
    const px = xCounts[xi] / n;
    if (px <= 0) continue;
    for (let yi = 0; yi < safeBins; yi++) {
      const joint = jointCounts[xi * safeBins + yi];
      if (joint === 0) continue;
      const pxy = joint / n;
      const py = yCounts[yi] / n;
      if (py <= 0) continue;
      mi += pxy * Math.log(pxy / (px * py));
    }
  }

  const norm = Math.log(safeBins);
  if (!Number.isFinite(mi)) return null;
  return norm > 0 ? Math.max(0, mi / norm) : Math.max(0, mi);
}

export interface StratIter57AParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  stoch_period: number;
  stoch_oversold: number;
  stoch_rebound_delta: number;
  mi_window: number;
  mi_lag: number;
  mi_bins: number;
  mi_floor: number;
  mi_rise_threshold: number;
  mi_collapse_threshold: number;
  mi_drop_from_entry: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter57AStrategy implements Strategy {
  params: StratIter57AParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private prevStoch: Map<string, number> = new Map();
  private prevMi: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private entryMi: Map<string, number> = new Map();

  constructor(params: Partial<StratIter57AParams> = {}) {
    const saved = loadSavedParams<StratIter57AParams>('strat_iter57_a.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      stoch_period: 14,
      stoch_oversold: 16,
      stoch_rebound_delta: 5,
      mi_window: 48,
      mi_lag: 3,
      mi_bins: 5,
      mi_floor: 0.12,
      mi_rise_threshold: 0.02,
      mi_collapse_threshold: 0.06,
      mi_drop_from_entry: 0.05,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter57AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [] });
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

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number, mi: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;

    const result = ctx.buy(bar.tokenId, size);
    if (!result.success) return false;

    this.entryPrice.set(bar.tokenId, bar.close);
    this.entryBar.set(bar.tokenId, barNum);
    this.entryMi.set(bar.tokenId, mi);
    return true;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.entryMi.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (shouldSkipPrice(bar.close)) return;

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr) return;

    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_period);
    if (k === null) return;

    const prevK = this.prevStoch.get(bar.tokenId);
    this.prevStoch.set(bar.tokenId, k);

    const mi = mutualInformationProxy(series.returns, this.params.mi_window, this.params.mi_lag, this.params.mi_bins);
    if (mi === null) return;

    const prevMi = this.prevMi.get(bar.tokenId) ?? mi;
    this.prevMi.set(bar.tokenId, mi);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBar = this.entryBar.get(bar.tokenId);
      const entryMi = this.entryMi.get(bar.tokenId);
      if (entry === undefined || entryBar === undefined || entryMi === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - entryBar >= this.params.max_hold_bars;
      const miCollapsed =
        mi <= this.params.mi_collapse_threshold ||
        mi <= entryMi - this.params.mi_drop_from_entry;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || miCollapsed) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (prevK === undefined) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;
    const miRising = mi >= this.params.mi_floor && mi - prevMi >= this.params.mi_rise_threshold;

    if (nearSupport && stochRebound && miRising) {
      this.open(ctx, bar, barNum, mi);
    }
  }
}
