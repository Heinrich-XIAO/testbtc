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
  return values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1);
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const sqDiffs = values.map(v => (v - m) * (v - m));
  return Math.sqrt(sqDiffs.reduce((sum, v) => sum + v, 0) / values.length);
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizedMomentum(closes: number[], momentumWindow: number, normWindow: number): number | null {
  const needed = Math.max(momentumWindow + 1, normWindow + 1);
  if (closes.length < needed) return null;

  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - momentumWindow];
  if (past <= 0) return null;

  const mom = (current - past) / past;
  const returns: number[] = [];
  for (let i = closes.length - normWindow; i < closes.length; i++) {
    const prev = closes[i - 1];
    const now = closes[i];
    if (prev > 0) returns.push((now - prev) / prev);
  }

  if (returns.length < 2) return null;
  const vol = stdDev(returns);
  if (vol < 1e-6) return 0;
  return mom / vol;
}

export interface StratIter53AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  support_buffer: number;
  short_momentum_window: number;
  long_momentum_window: number;
  short_norm_window: number;
  long_norm_window: number;
  short_phase_gain: number;
  long_phase_gain: number;
  phase_step_limit: number;
  interference_entry_threshold: number;
  destructive_exit_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter53AStrategy implements Strategy {
  params: StratIter53AParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private shortPhase: Map<string, number> = new Map();
  private longPhase: Map<string, number> = new Map();
  private prevAlignment: Map<string, number> = new Map();

  constructor(params: Partial<StratIter53AParams> = {}) {
    const saved = loadSavedParams<StratIter53AParams>('strat_iter53_a.params.json');
    this.params = {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      support_buffer: 0.015,
      short_momentum_window: 4,
      long_momentum_window: 18,
      short_norm_window: 14,
      long_norm_window: 40,
      short_phase_gain: 0.30,
      long_phase_gain: 0.14,
      phase_step_limit: 0.65,
      interference_entry_threshold: 1.10,
      destructive_exit_threshold: 1.05,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter53AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], opens: [] });
      this.bars.set(bar.tokenId, 0);
      this.shortPhase.set(bar.tokenId, 0);
      this.longPhase.set(bar.tokenId, 0);
      this.prevAlignment.set(bar.tokenId, 0);
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

  private open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
    const cash = ctx.getCapital() * riskPercent * 0.995;
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

  private stepPhases(tokenId: string, shortNormMom: number, longNormMom: number): { shortWave: number; longWave: number } {
    const shortDelta = clamp(shortNormMom * this.params.short_phase_gain, -this.params.phase_step_limit, this.params.phase_step_limit);
    const longDelta = clamp(longNormMom * this.params.long_phase_gain, -this.params.phase_step_limit, this.params.phase_step_limit);

    const nextShortPhase = (this.shortPhase.get(tokenId) || 0) + shortDelta;
    const nextLongPhase = (this.longPhase.get(tokenId) || 0) + longDelta;
    this.shortPhase.set(tokenId, nextShortPhase);
    this.longPhase.set(tokenId, nextLongPhase);

    return {
      shortWave: Math.sin(nextShortPhase),
      longWave: Math.sin(nextLongPhase),
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    const shortNormMom = normalizedMomentum(series.closes, this.params.short_momentum_window, this.params.short_norm_window);
    const longNormMom = normalizedMomentum(series.closes, this.params.long_momentum_window, this.params.long_norm_window);
    if (shortNormMom === null || longNormMom === null) return;

    const { shortWave, longWave } = this.stepPhases(bar.tokenId, shortNormMom, longNormMom);
    const sumWave = shortWave + longWave;
    const diffWave = shortWave - longWave;
    const constructiveAmplitude = Math.abs(sumWave);
    const destructiveAmplitude = Math.abs(diffWave);
    const alignment = shortWave * longWave;
    const prevAlignment = this.prevAlignment.get(bar.tokenId) || 0;
    this.prevAlignment.set(bar.tokenId, alignment);

    const destructiveFlip = prevAlignment >= 0 && alignment < 0 && destructiveAmplitude >= this.params.destructive_exit_threshold;

    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      const stopLossHit = bar.low <= e * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= e * (1 + this.params.profit_target);
      const resistanceHit = sr !== null && bar.high >= sr.resistance * 0.98;
      const maxHoldReached = barNum - eb >= this.params.max_hold_bars;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || destructiveFlip) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close)) return;

    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k === null) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochOversold = k <= this.params.stoch_oversold;
    const constructiveSignal = alignment > 0 && constructiveAmplitude >= this.params.interference_entry_threshold;

    if (constructiveSignal && stochOversold && nearSupport) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
