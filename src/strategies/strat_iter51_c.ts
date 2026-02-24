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

function capPush(values: number[], value: number, max = 700): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((s, x) => s + (x - m) * (x - m), 0) / values.length;
}

function autocorrelation(values: number[], lag: number): number {
  if (values.length < lag + 2) return 0;
  const n = values.length;
  const m = mean(values);
  const v = variance(values);
  if (v === 0) return 0;
  let sum = 0;
  for (let i = lag; i < n; i++) {
    sum += (values[i] - m) * (values[i - lag] - m);
  }
  return sum / ((n - lag) * v);
}

function findDominantCycle(closes: number[], minPeriod: number, maxPeriod: number): number | null {
  if (closes.length < maxPeriod + 2) return null;
  let maxAutocorr = -2;
  let dominantPeriod = null;
  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    const ac = autocorrelation(closes, lag);
    if (ac > maxAutocorr) {
      maxAutocorr = ac;
      dominantPeriod = lag;
    }
  }
  return dominantPeriod;
}

function estimatePhase(closes: number[], cyclePeriod: number): number {
  if (cyclePeriod === null || cyclePeriod < 2 || closes.length < cyclePeriod) return 0;
  const recentCloses = closes.slice(-cyclePeriod);
  const minPrice = Math.min(...recentCloses);
  const maxPrice = Math.max(...recentCloses);
  const currentPrice = closes[closes.length - 1];
  if (maxPrice === minPrice) return 0.5;
  return (currentPrice - minPrice) / (maxPrice - minPrice);
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

export interface StratIter51CParams extends StrategyParams {
  sr_lookback: number;
  min_cycle_period: number;
  max_cycle_period: number;
  trough_threshold: number;
  peak_threshold: number;
  min_autocorr: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter51CStrategy implements Strategy {
  params: StratIter51CParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private cyclePeriods: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter51CParams> = {}) {
    const saved = loadSavedParams<StratIter51CParams>('strat_iter51_c.params.json');
    this.params = {
      sr_lookback: 50,
      min_cycle_period: 8,
      max_cycle_period: 32,
      trough_threshold: 0.25,
      peak_threshold: 0.75,
      min_autocorr: 0.3,
      support_buffer: 0.015,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter51CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
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

  private open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
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

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  private baseExit(
    ctx: BacktestContext,
    bar: Bar,
    barNum: number,
    stopLoss: number,
    profitTarget: number,
    maxHoldBars: number,
    resistance: number | null
  ): boolean {
    const e = this.entryPrice.get(bar.tokenId);
    const eb = this.entryBar.get(bar.tokenId);
    if (!e || eb === undefined) return false;
    const exitNow =
      bar.low <= e * (1 - stopLoss) ||
      bar.high >= e * (1 + profitTarget) ||
      (resistance !== null && bar.high >= resistance * 0.98) ||
      barNum - eb >= maxHoldBars;
    if (exitNow) this.close(ctx, bar.tokenId);
    return exitNow;
  }

  onComplete(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0) {
      if (!this.cyclePeriods.has(bar.tokenId)) this.cyclePeriods.set(bar.tokenId, []);
      const cpv = this.cyclePeriods.get(bar.tokenId)!;
      const cyclePeriod = cpv.length > 0 ? cpv[cpv.length - 1] : null;
      let shouldExit = this.baseExit(ctx, bar, barNum, this.params.stop_loss, this.params.profit_target, this.params.max_hold_bars, sr?.resistance ?? null);
      if (!shouldExit && cyclePeriod !== null && cyclePeriod >= 2) {
        const phase = estimatePhase(series.closes, cyclePeriod);
        if (phase >= this.params.peak_threshold) {
          this.close(ctx, bar.tokenId);
          shouldExit = true;
        }
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close)) return;
    if (series.closes.length < this.params.max_cycle_period + 2) return;

    if (!this.cyclePeriods.has(bar.tokenId)) this.cyclePeriods.set(bar.tokenId, []);
    const cyclePeriod = findDominantCycle(series.closes, this.params.min_cycle_period, this.params.max_cycle_period);
    if (cyclePeriod === null) return;

    const maxAc = autocorrelation(series.closes, cyclePeriod);
    capPush(this.cyclePeriods.get(bar.tokenId)!, cyclePeriod);
    if (maxAc < this.params.min_autocorr) return;

    const phase = estimatePhase(series.closes, cyclePeriod);
    if (phase > this.params.trough_threshold) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    if (!nearSupport) return;

    const prevClose = series.closes[series.closes.length - 2];
    const momentumUp = bar.close > prevClose;
    if (!momentumUp) return;

    this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
