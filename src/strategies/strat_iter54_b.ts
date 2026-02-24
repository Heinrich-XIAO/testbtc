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

function capPush(values: number[], value: number, max = 900): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
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

function returnsFromCloses(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    if (prev <= 0) continue;
    returns.push((closes[i] - prev) / prev);
  }
  return returns;
}

function histogram(values: number[], bins: number, clip: number): number[] {
  const counts = Array.from({ length: bins }, () => 1e-6);
  const min = -clip;
  const max = clip;
  const width = (max - min) / bins;
  for (const vRaw of values) {
    const v = Math.max(min, Math.min(max, vRaw));
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / width)));
    counts[idx] += 1;
  }
  return counts;
}

function normalize(values: number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);
  return values.map(v => v / total);
}

function klDivergence(p: number[], q: number[]): number {
  let kl = 0;
  for (let i = 0; i < p.length; i++) {
    kl += p[i] * Math.log(p[i] / q[i]);
  }
  return kl;
}

export interface StratIter54BParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  recent_window: number;
  baseline_window: number;
  kl_bins: number;
  kl_clip_return: number;
  kl_stats_window: number;
  kl_spike_z: number;
  kl_min_spike: number;
  kl_reversion_ratio: number;
  shock_max_age: number;
  kl_reexpand_multiplier: number;
  kl_reexpand_z: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter54BStrategy implements Strategy {
  params: StratIter54BParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private shockPeakKl: Map<string, number> = new Map();
  private shockAge: Map<string, number> = new Map();
  private entryKl: Map<string, number> = new Map();
  private klHistory: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter54BParams> = {}) {
    const saved = loadSavedParams<StratIter54BParams>('strat_iter54_b.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      recent_window: 10,
      baseline_window: 70,
      kl_bins: 20,
      kl_clip_return: 0.04,
      kl_stats_window: 40,
      kl_spike_z: 1.4,
      kl_min_spike: 0.12,
      kl_reversion_ratio: 0.62,
      shock_max_age: 10,
      kl_reexpand_multiplier: 1.8,
      kl_reexpand_z: 0.9,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter54BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
      this.klHistory.set(bar.tokenId, []);
      this.shockAge.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private computeKl(series: TokenSeries): number | null {
    const allReturns = returnsFromCloses(series.closes);
    const minNeeded = this.params.recent_window + this.params.baseline_window;
    if (allReturns.length < minNeeded) return null;

    const recent = allReturns.slice(-this.params.recent_window);
    const baselineStart = allReturns.length - (this.params.recent_window + this.params.baseline_window);
    const baselineEnd = allReturns.length - this.params.recent_window;
    const baseline = allReturns.slice(baselineStart, baselineEnd);

    const recentHist = normalize(histogram(recent, this.params.kl_bins, this.params.kl_clip_return));
    const baselineHist = normalize(histogram(baseline, this.params.kl_bins, this.params.kl_clip_return));
    return klDivergence(recentHist, baselineHist);
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number, kl: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (!result.success) return false;
    this.entryPrice.set(bar.tokenId, bar.close);
    this.entryBar.set(bar.tokenId, barNum);
    this.entryKl.set(bar.tokenId, kl);
    return true;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.entryKl.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const kl = this.computeKl(series);
    const pos = ctx.getPosition(bar.tokenId);

    if (!sr || shouldSkipPrice(bar.close) || kl === null) return;

    const klHist = this.klHistory.get(bar.tokenId)!;
    capPush(klHist, kl, 120);

    if (klHist.length > 1) {
      const statsSource = klHist.slice(-Math.max(this.params.kl_stats_window, 8));
      const klMean = mean(statsSource);
      const klStd = stdDev(statsSource);
      const klSpikeLevel = klMean + this.params.kl_spike_z * klStd;
      const isSpike = kl >= Math.max(this.params.kl_min_spike, klSpikeLevel);

      if (isSpike) {
        this.shockPeakKl.set(bar.tokenId, kl);
        this.shockAge.set(bar.tokenId, 0);
      } else if (this.shockPeakKl.has(bar.tokenId)) {
        this.shockAge.set(bar.tokenId, (this.shockAge.get(bar.tokenId) || 0) + 1);
      }

      const shockPeak = this.shockPeakKl.get(bar.tokenId);
      const age = this.shockAge.get(bar.tokenId) || 0;
      const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer) && bar.close >= sr.support * 0.995;

      if (pos && pos.size > 0) {
        const entry = this.entryPrice.get(bar.tokenId)!;
        const enteredBar = this.entryBar.get(bar.tokenId)!;
        const entryKl = this.entryKl.get(bar.tokenId) ?? kl;

        const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
        const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
        const resistanceHit = bar.high >= sr.resistance * 0.98;
        const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
        const reexpandBySize = kl >= entryKl * this.params.kl_reexpand_multiplier;
        const reexpandByRegime = kl >= klMean + this.params.kl_reexpand_z * klStd;

        if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || (reexpandBySize && reexpandByRegime)) {
          this.close(ctx, bar.tokenId);
        }
        return;
      }

      if (shockPeak === undefined || age > this.params.shock_max_age) return;
      const stabilized = kl <= shockPeak * this.params.kl_reversion_ratio;
      if (stabilized && nearSupport) {
        const opened = this.open(ctx, bar, barNum, kl);
        if (opened) {
          this.shockPeakKl.delete(bar.tokenId);
          this.shockAge.set(bar.tokenId, 0);
        }
      }
    }
  }
}
