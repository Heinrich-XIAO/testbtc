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

function capPush(values: number[], value: number, max = 800): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function sigmoid(x: number): number {
  if (x >= 35) return 1;
  if (x <= -35) return 0;
  return 1 / (1 + Math.exp(-x));
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

export interface StratIter56BParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_touch_lookback: number;
  support_hold_bars: number;
  support_break_tolerance: number;
  support_reclaim_buffer: number;
  state_persistence: number;
  posterior_blend: number;
  volatility_window: number;
  sigma_floor: number;
  bull_drift: number;
  bear_drift: number;
  likelihood_ratio_gain: number;
  entry_posterior_threshold: number;
  defensive_posterior_threshold: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter56BStrategy implements Strategy {
  params: StratIter56BParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private bullPosterior: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter56BParams> = {}) {
    const saved = loadSavedParams<StratIter56BParams>('strat_iter56_b.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      support_touch_lookback: 10,
      support_hold_bars: 4,
      support_break_tolerance: 0.01,
      support_reclaim_buffer: 0.003,
      state_persistence: 0.9,
      posterior_blend: 0.85,
      volatility_window: 24,
      sigma_floor: 0.004,
      bull_drift: 0.003,
      bear_drift: 0.002,
      likelihood_ratio_gain: 1.25,
      entry_posterior_threshold: 0.7,
      defensive_posterior_threshold: 0.45,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter56BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [] });
      this.bars.set(bar.tokenId, 0);
      this.bullPosterior.set(bar.tokenId, 0.5);
    }

    const s = this.series.get(bar.tokenId)!;
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    if (prevClose && prevClose > 0) {
      const ret = (bar.close - prevClose) / prevClose;
      capPush(s.returns, ret);
    }

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private updateBullPosterior(tokenId: string, returns: number[]): { previous: number; current: number } {
    const previous = clamp01(this.bullPosterior.get(tokenId) ?? 0.5);
    if (returns.length === 0) {
      this.bullPosterior.set(tokenId, previous);
      return { previous, current: previous };
    }

    const latestReturn = returns[returns.length - 1];
    const volSample = returns.slice(-this.params.volatility_window);
    const sigma = Math.max(this.params.sigma_floor, stdDev(volSample));
    const sigma2 = sigma * sigma;

    const bullMean = Math.abs(this.params.bull_drift);
    const bearMean = -Math.abs(this.params.bear_drift);
    const logLikeBull = -((latestReturn - bullMean) * (latestReturn - bullMean)) / (2 * sigma2);
    const logLikeBear = -((latestReturn - bearMean) * (latestReturn - bearMean)) / (2 * sigma2);
    const logLikelihoodRatio = (logLikeBull - logLikeBear) * this.params.likelihood_ratio_gain;

    const persistence = Math.min(0.995, Math.max(0.5, this.params.state_persistence));
    const priorBull = previous * persistence + (1 - previous) * (1 - persistence);
    const safePrior = Math.min(1 - 1e-6, Math.max(1e-6, priorBull));
    const priorLogit = Math.log(safePrior / (1 - safePrior));

    const posteriorRaw = sigmoid(priorLogit + logLikelihoodRatio);
    const blend = clamp01(this.params.posterior_blend);
    const current = clamp01(safePrior * (1 - blend) + posteriorRaw * blend);
    this.bullPosterior.set(tokenId, current);
    return { previous, current };
  }

  private hasSupportHold(series: TokenSeries, support: number): boolean {
    const touchLookback = Math.max(2, Math.floor(this.params.support_touch_lookback));
    const holdBars = Math.max(2, Math.floor(this.params.support_hold_bars));
    const needs = Math.max(touchLookback, holdBars);
    if (series.lows.length < needs || series.closes.length < holdBars) return false;

    const touchWindow = series.lows.slice(-touchLookback);
    const touchedSupport = touchWindow.some((low) => low <= support * (1 + this.params.support_buffer));
    if (!touchedSupport) return false;

    const holdWindowLows = series.lows.slice(-holdBars);
    const supportHeld = holdWindowLows.every((low) => low >= support * (1 - this.params.support_break_tolerance));
    if (!supportHeld) return false;

    const latestClose = series.closes[series.closes.length - 1];
    return latestClose >= support * (1 + this.params.support_reclaim_buffer);
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
    const pos = ctx.getPosition(bar.tokenId);
    if (shouldSkipPrice(bar.close)) return;

    const posterior = this.updateBullPosterior(bar.tokenId, series.returns);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr) return;

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - entryBar >= this.params.max_hold_bars;
      const defensivePosterior = posterior.current <= this.params.defensive_posterior_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || defensivePosterior) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const crossedUp = posterior.previous < this.params.entry_posterior_threshold && posterior.current >= this.params.entry_posterior_threshold;
    if (!crossedUp) return;

    if (this.hasSupportHold(series, sr.support)) {
      this.open(ctx, bar, barNum);
    }
  }
}
