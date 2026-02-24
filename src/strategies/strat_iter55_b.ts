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
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
}

function momentum(closes: number[], period: number): number | null {
  if (period < 1 || closes.length <= period) return null;
  const now = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - period];
  if (prev <= 0) return null;
  return (now - prev) / prev;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function sigmoid(x: number): number {
  if (x >= 35) return 1;
  if (x <= -35) return 0;
  return 1 / (1 + Math.exp(-x));
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

export interface StratIter55BParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  trend_short_period: number;
  trend_long_period: number;
  zscore_window: number;
  volatility_window: number;
  trend_mom_weight: number;
  trend_breakout_weight: number;
  trend_overheat_penalty: number;
  mr_reversion_weight: number;
  mr_support_weight: number;
  mr_chase_penalty: number;
  trend_coupling: number;
  mr_coupling: number;
  game_temperature: number;
  game_iterations: number;
  equilibrium_long_threshold: number;
  equilibrium_defensive_threshold: number;
  consensus_weight_trend: number;
  consensus_weight_mr: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter55BStrategy implements Strategy {
  params: StratIter55BParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter55BParams> = {}) {
    const saved = loadSavedParams<StratIter55BParams>('strat_iter55_b.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      trend_short_period: 3,
      trend_long_period: 14,
      zscore_window: 18,
      volatility_window: 14,
      trend_mom_weight: 1.2,
      trend_breakout_weight: 0.8,
      trend_overheat_penalty: 0.6,
      mr_reversion_weight: 1.5,
      mr_support_weight: 1.1,
      mr_chase_penalty: 0.7,
      trend_coupling: 0.9,
      mr_coupling: 0.7,
      game_temperature: 0.8,
      game_iterations: 5,
      equilibrium_long_threshold: 0.62,
      equilibrium_defensive_threshold: 0.42,
      consensus_weight_trend: 1.0,
      consensus_weight_mr: 1.3,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter55BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

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

  private computeFeatures(series: TokenSeries, bar: Bar, support: number, resistance: number): {
    trendShort: number;
    trendLong: number;
    zScore: number;
    supportProximity: number;
    breakoutPressure: number;
    normalizedVolatility: number;
  } | null {
    const trendShort = momentum(series.closes, this.params.trend_short_period);
    const trendLong = momentum(series.closes, this.params.trend_long_period);
    if (trendShort === null || trendLong === null) return null;

    if (series.closes.length < this.params.zscore_window + 1 || series.closes.length < this.params.volatility_window + 1) {
      return null;
    }

    const zBase = series.closes.slice(-(this.params.zscore_window + 1), -1);
    const zMean = mean(zBase);
    const zStd = stdDev(zBase);
    const zScore = zStd === 0 ? 0 : (bar.close - zMean) / zStd;

    const range = Math.max(1e-6, resistance - support);
    const supportDistance = Math.max(0, bar.close - support);
    const supportProximity = clamp01(1 - supportDistance / (range * (1 + this.params.support_buffer)));

    const breakoutPressure = clamp01((bar.close - support) / range);

    const volBase = series.closes.slice(-(this.params.volatility_window + 1));
    const returns: number[] = [];
    for (let i = 1; i < volBase.length; i++) {
      const prev = volBase[i - 1];
      if (prev > 0) returns.push((volBase[i] - prev) / prev);
    }
    const normalizedVolatility = returns.length > 1 ? Math.min(0.06, stdDev(returns)) / 0.06 : 0;

    return { trendShort, trendLong, zScore, supportProximity, breakoutPressure, normalizedVolatility };
  }

  private equilibriumLongProbability(features: {
    trendShort: number;
    trendLong: number;
    zScore: number;
    supportProximity: number;
    breakoutPressure: number;
    normalizedVolatility: number;
  }): number {
    const trendBase =
      this.params.trend_mom_weight * (1.25 * features.trendLong + 0.75 * features.trendShort) +
      this.params.trend_breakout_weight * (features.breakoutPressure - 0.5) * 2 -
      this.params.trend_overheat_penalty * Math.max(0, features.zScore - 0.25) -
      0.3 * features.normalizedVolatility;

    const mrBase =
      this.params.mr_reversion_weight * Math.max(0, -features.zScore) +
      this.params.mr_support_weight * features.supportProximity -
      this.params.mr_chase_penalty * Math.max(0, features.trendShort) -
      0.15 * features.normalizedVolatility;

    const temperature = Math.max(0.15, this.params.game_temperature);
    let pTrend = 0.5;
    let pMeanRevert = 0.5;
    const iterations = Math.max(1, Math.round(this.params.game_iterations));

    for (let i = 0; i < iterations; i++) {
      const trendDelta = trendBase + this.params.trend_coupling * (2 * pMeanRevert - 1);
      const mrDelta = mrBase + this.params.mr_coupling * (2 * pTrend - 1);
      pTrend = sigmoid(trendDelta / temperature);
      pMeanRevert = sigmoid(mrDelta / temperature);
    }

    const totalWeight = Math.max(1e-6, this.params.consensus_weight_trend + this.params.consensus_weight_mr);
    return (pTrend * this.params.consensus_weight_trend + pMeanRevert * this.params.consensus_weight_mr) / totalWeight;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (!sr || shouldSkipPrice(bar.close)) return;

    const features = this.computeFeatures(series, bar, sr.support, sr.resistance);
    if (!features) return;

    const eqLong = this.equilibriumLongProbability(features);

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * 0.985;
      const maxHoldReached = barNum - entryBar >= this.params.max_hold_bars;
      const equilibriumDefensive = eqLong <= this.params.equilibrium_defensive_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || equilibriumDefensive) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    if (nearSupport && eqLong >= this.params.equilibrium_long_threshold) {
      this.open(ctx, bar, barNum);
    }
  }
}
