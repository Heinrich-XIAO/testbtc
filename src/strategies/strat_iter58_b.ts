import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  opens: number[];
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  ranges: number[];
};

type ModelSnapshot = {
  trend: number;
  meanRevert: number;
  volBreakout: number;
};

type EnsembleState = {
  modelErrors: ModelSnapshot;
  modelWeights: ModelSnapshot;
  prevPrediction: ModelSnapshot | null;
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
  const variance = mean(values.map((v) => (v - m) * (v - m)));
  return Math.sqrt(Math.max(0, variance));
}

function ema(values: number[], period: number): number | null {
  const p = Math.max(2, Math.floor(period));
  if (values.length < p) return null;
  const alpha = 2 / (p + 1);
  let value = values[values.length - p];
  for (let i = values.length - p + 1; i < values.length; i++) {
    value = alpha * values[i] + (1 - alpha) * value;
  }
  return value;
}

function sigmoid(x: number): number {
  const clamped = Math.max(-30, Math.min(30, x));
  return 1 / (1 + Math.exp(-clamped));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

export interface StratIter58BParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  trend_fast_period: number;
  trend_slow_period: number;
  trend_momentum_lookback: number;
  trend_score_scale: number;
  mean_revert_window: number;
  mean_revert_support_scale: number;
  mean_revert_oversold_scale: number;
  mean_revert_rebound_scale: number;
  vol_window: number;
  breakout_lookback: number;
  vol_breakout_ratio_threshold: number;
  vol_breakout_score_scale: number;
  bma_error_alpha: number;
  bma_weight_temperature: number;
  bma_weight_floor: number;
  entry_posterior_threshold: number;
  exit_posterior_threshold: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter58BStrategy implements Strategy {
  params: StratIter58BParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private ensemble: Map<string, EnsembleState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter58BParams> = {}) {
    const saved = loadSavedParams<StratIter58BParams>('strat_iter58_b.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.018,
      trend_fast_period: 8,
      trend_slow_period: 26,
      trend_momentum_lookback: 5,
      trend_score_scale: 60,
      mean_revert_window: 14,
      mean_revert_support_scale: 140,
      mean_revert_oversold_scale: 70,
      mean_revert_rebound_scale: 35,
      vol_window: 20,
      breakout_lookback: 10,
      vol_breakout_ratio_threshold: 1.2,
      vol_breakout_score_scale: 4.5,
      bma_error_alpha: 0.14,
      bma_weight_temperature: 7,
      bma_weight_floor: 0.05,
      entry_posterior_threshold: 0.60,
      exit_posterior_threshold: 0.42,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter58BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number; barReturn: number | null } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, {
        opens: [],
        closes: [],
        highs: [],
        lows: [],
        returns: [],
        ranges: [],
      });
      this.bars.set(bar.tokenId, 0);
    }

    if (!this.ensemble.has(bar.tokenId)) {
      this.ensemble.set(bar.tokenId, {
        modelErrors: { trend: 0.25, meanRevert: 0.25, volBreakout: 0.25 },
        modelWeights: { trend: 1 / 3, meanRevert: 1 / 3, volBreakout: 1 / 3 },
        prevPrediction: null,
      });
    }

    const s = this.series.get(bar.tokenId)!;
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;
    const barReturn = prevClose && prevClose > 0 ? (bar.close - prevClose) / prevClose : null;

    capPush(s.opens, bar.open);
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    capPush(s.ranges, Math.max(0, bar.high - bar.low));
    if (barReturn !== null) capPush(s.returns, barReturn);

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum, barReturn };
  }

  private updateBayesianWeights(tokenId: string, realizedReturn: number | null): void {
    if (realizedReturn === null) return;

    const state = this.ensemble.get(tokenId);
    if (!state || !state.prevPrediction) return;

    const alpha = clamp(this.params.bma_error_alpha, 0.01, 0.8);
    const target = realizedReturn > 0 ? 1 : 0;

    const trendErr = (state.prevPrediction.trend - target) ** 2;
    const meanRevertErr = (state.prevPrediction.meanRevert - target) ** 2;
    const volBreakoutErr = (state.prevPrediction.volBreakout - target) ** 2;

    state.modelErrors.trend = (1 - alpha) * state.modelErrors.trend + alpha * trendErr;
    state.modelErrors.meanRevert = (1 - alpha) * state.modelErrors.meanRevert + alpha * meanRevertErr;
    state.modelErrors.volBreakout = (1 - alpha) * state.modelErrors.volBreakout + alpha * volBreakoutErr;

    const temp = Math.max(0.5, this.params.bma_weight_temperature);
    const floor = clamp(this.params.bma_weight_floor, 0.001, 0.25);

    const trendRaw = Math.max(floor, Math.exp(-temp * state.modelErrors.trend));
    const meanRevertRaw = Math.max(floor, Math.exp(-temp * state.modelErrors.meanRevert));
    const volBreakoutRaw = Math.max(floor, Math.exp(-temp * state.modelErrors.volBreakout));
    const total = trendRaw + meanRevertRaw + volBreakoutRaw;

    state.modelWeights.trend = trendRaw / total;
    state.modelWeights.meanRevert = meanRevertRaw / total;
    state.modelWeights.volBreakout = volBreakoutRaw / total;
  }

  private computeTrendScore(series: TokenSeries): number | null {
    const fast = ema(series.closes, this.params.trend_fast_period);
    const slow = ema(series.closes, this.params.trend_slow_period);
    const momentumLookback = Math.max(2, Math.floor(this.params.trend_momentum_lookback));
    if (fast === null || slow === null || series.closes.length <= momentumLookback || series.returns.length < 6) return null;

    const close = series.closes[series.closes.length - 1];
    const momBase = series.closes[series.closes.length - 1 - momentumLookback];
    const momentum = momBase > 0 ? (close - momBase) / momBase : 0;
    const vol = Math.max(1e-6, stdDev(series.returns.slice(-Math.max(6, momentumLookback + 1))));
    const trendEdge = (fast - slow) / Math.max(1e-6, slow);
    return sigmoid((trendEdge + momentum) * this.params.trend_score_scale / (1 + 12 * vol));
  }

  private computeMeanRevertScore(series: TokenSeries, support: number): number | null {
    const w = Math.max(4, Math.floor(this.params.mean_revert_window));
    if (series.closes.length < w + 2 || series.returns.length < w + 1) return null;

    const close = series.closes[series.closes.length - 1];
    const supportDist = support > 0 ? (close - support) / support : 0;
    const returns = series.returns.slice(-w);
    const avgReturn = mean(returns);
    const downside = Math.max(0, -avgReturn);
    const rebound = series.returns[series.returns.length - 1];

    const score =
      -supportDist * this.params.mean_revert_support_scale +
      downside * this.params.mean_revert_oversold_scale +
      rebound * this.params.mean_revert_rebound_scale;
    return sigmoid(score);
  }

  private computeVolBreakoutScore(series: TokenSeries): number | null {
    const volWindow = Math.max(8, Math.floor(this.params.vol_window));
    const breakoutLookback = Math.max(3, Math.floor(this.params.breakout_lookback));
    if (series.returns.length < volWindow + 2 || series.highs.length < breakoutLookback + 2 || series.ranges.length < volWindow + 1) return null;

    const recentVol = stdDev(series.returns.slice(-volWindow));
    const baseVol = Math.max(1e-6, stdDev(series.returns.slice(-volWindow * 2, -volWindow)));
    const volRatio = recentVol / baseVol;

    const prevHigh = Math.max(...series.highs.slice(-(breakoutLookback + 1), -1));
    const close = series.closes[series.closes.length - 1];
    const breakoutEdge = prevHigh > 0 ? (close - prevHigh) / prevHigh : 0;

    const rangeNow = series.ranges[series.ranges.length - 1];
    const avgRange = Math.max(1e-6, mean(series.ranges.slice(-volWindow)));
    const rangeRatio = rangeNow / avgRange;

    const raw =
      (volRatio - this.params.vol_breakout_ratio_threshold) * this.params.vol_breakout_score_scale +
      breakoutEdge * 80 +
      (rangeRatio - 1) * 0.8;
    return sigmoid(raw);
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
    const { series, barNum, barReturn } = this.nextBar(bar);
    if (shouldSkipPrice(bar.close)) return;

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr) return;

    this.updateBayesianWeights(bar.tokenId, barReturn);

    const trendScore = this.computeTrendScore(series);
    const meanRevertScore = this.computeMeanRevertScore(series, sr.support);
    const volBreakoutScore = this.computeVolBreakoutScore(series);
    if (trendScore === null || meanRevertScore === null || volBreakoutScore === null) return;

    const ensembleState = this.ensemble.get(bar.tokenId)!;
    const posteriorLong =
      ensembleState.modelWeights.trend * trendScore +
      ensembleState.modelWeights.meanRevert * meanRevertScore +
      ensembleState.modelWeights.volBreakout * volBreakoutScore;

    ensembleState.prevPrediction = {
      trend: trendScore,
      meanRevert: meanRevertScore,
      volBreakout: volBreakoutScore,
    };

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
      const posteriorBreak = posteriorLong <= this.params.exit_posterior_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || posteriorBreak) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    if (nearSupport && posteriorLong >= this.params.entry_posterior_threshold) {
      this.open(ctx, bar, barNum);
    }
  }
}
