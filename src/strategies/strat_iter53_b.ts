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

function capPush(values: number[], value: number, max = 600): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const highest = Math.max(...highs.slice(-period));
  const lowest = Math.min(...lows.slice(-period));
  if (highest === lowest) return 50;
  return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
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

function ramp(value: number, low: number, high: number): number {
  if (high <= low) return value >= high ? 1 : 0;
  if (value <= low) return 0;
  if (value >= high) return 1;
  return (value - low) / (high - low);
}

function inverseRamp(value: number, low: number, high: number): number {
  return 1 - ramp(value, low, high);
}

export interface StratIter53BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  oversold_full_score_k: number;
  oversold_zero_score_k: number;
  support_full_score_dist: number;
  support_zero_score_dist: number;
  momentum_lookback: number;
  momentum_min_return: number;
  momentum_max_return: number;
  stoch_recovery_min: number;
  stoch_recovery_max: number;
  fuzzy_and_weight: number;
  fuzzy_or_weight: number;
  fuzzy_entry_threshold: number;
  fuzzy_exit_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter53BStrategy implements Strategy {
  params: StratIter53BParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private stochValues: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter53BParams> = {}) {
    const saved = loadSavedParams<StratIter53BParams>('strat_iter53_b.params.json');
    this.params = {
      sr_lookback: 50,
      stoch_k_period: 14,
      oversold_full_score_k: 10,
      oversold_zero_score_k: 24,
      support_full_score_dist: 0.004,
      support_zero_score_dist: 0.02,
      momentum_lookback: 4,
      momentum_min_return: -0.002,
      momentum_max_return: 0.012,
      stoch_recovery_min: -1.5,
      stoch_recovery_max: 6,
      fuzzy_and_weight: 0.65,
      fuzzy_or_weight: 0.35,
      fuzzy_entry_threshold: 0.58,
      fuzzy_exit_threshold: 0.34,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter53BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
    }
    if (!this.stochValues.has(bar.tokenId)) this.stochValues.set(bar.tokenId, []);

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

  private fuzzyConfidence(series: TokenSeries, bar: Bar, sr: { support: number; resistance: number }, k: number, kPrev: number): number {
    const oversoldness = inverseRamp(k, this.params.oversold_full_score_k, this.params.oversold_zero_score_k);

    const supportDistance = Math.abs(bar.close - sr.support) / Math.max(sr.support, 1e-9);
    const supportProximity = inverseRamp(supportDistance, this.params.support_full_score_dist, this.params.support_zero_score_dist);

    const lookback = this.params.momentum_lookback;
    if (series.closes.length < lookback + 1) return 0;
    const prevClose = series.closes[series.closes.length - 1 - lookback];
    const priceReturn = prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;
    const priceRecovery = ramp(priceReturn, this.params.momentum_min_return, this.params.momentum_max_return);
    const stochDelta = k - kPrev;
    const stochRecovery = ramp(stochDelta, this.params.stoch_recovery_min, this.params.stoch_recovery_max);
    const momentumRecovery = 0.6 * priceRecovery + 0.4 * stochRecovery;

    const fuzzyAnd = Math.min(oversoldness, supportProximity, momentumRecovery);
    const fuzzyOr = Math.max(oversoldness, supportProximity, momentumRecovery);
    const totalWeight = this.params.fuzzy_and_weight + this.params.fuzzy_or_weight;
    if (totalWeight <= 0) return 0;
    return (this.params.fuzzy_and_weight * fuzzyAnd + this.params.fuzzy_or_weight * fuzzyOr) / totalWeight;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.stochValues.get(bar.tokenId)!, k);
    const kValues = this.stochValues.get(bar.tokenId)!;

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entryPrice = this.entryPrice.get(bar.tokenId)!;
      const enteredBar = this.entryBar.get(bar.tokenId)!;

      const stopLossHit = bar.low <= entryPrice * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entryPrice * (1 + this.params.profit_target);
      const resistanceHit = sr !== null && bar.high >= sr.resistance * 0.98;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;

      let confidenceCollapse = false;
      if (sr !== null && k !== null && kValues.length >= 2) {
        const currentConfidence = this.fuzzyConfidence(series, bar, sr, k, kValues[kValues.length - 2]);
        confidenceCollapse = currentConfidence <= this.params.fuzzy_exit_threshold;
      }

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || confidenceCollapse) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || sr === null || k === null || kValues.length < 2) return;

    const confidence = this.fuzzyConfidence(series, bar, sr, k, kValues[kValues.length - 2]);
    if (confidence >= this.params.fuzzy_entry_threshold) {
      this.open(ctx, bar, barNum);
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
