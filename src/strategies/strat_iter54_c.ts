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

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function momentum(closes: number[], period: number): number | null {
  if (closes.length <= period || period < 1) return null;
  const now = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - period];
  if (prev <= 0) return null;
  return (now - prev) / prev;
}

function rollingZScore(closes: number[], window: number): number | null {
  if (closes.length < window + 1) return null;
  const slice = closes.slice(-(window + 1), -1);
  const m = mean(slice);
  const sd = stdDev(slice);
  if (sd === 0) return 0;
  return (closes[closes.length - 1] - m) / sd;
}

function nearSupport(low: number, support: number, supportBuffer: number): boolean {
  return low <= support * (1 + supportBuffer);
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function signVote(signal: boolean, antiSignal: boolean): number {
  if (signal && !antiSignal) return 1;
  if (antiSignal && !signal) return -1;
  return 0;
}

export interface StratIter54CParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  trend_short_mom_period: number;
  trend_long_mom_period: number;
  trend_entry_mom: number;
  trend_confirm_mom: number;
  trend_range_floor: number;
  mr_zscore_window: number;
  mr_zscore_entry: number;
  breakout_window: number;
  breakout_buffer: number;
  breakout_mom_period: number;
  trend_weight: number;
  mean_revert_weight: number;
  breakout_weight: number;
  consensus_entry_threshold: number;
  consensus_negative_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter54CStrategy implements Strategy {
  params: StratIter54CParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter54CParams> = {}) {
    const saved = loadSavedParams<StratIter54CParams>('strat_iter54_c.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      trend_short_mom_period: 3,
      trend_long_mom_period: 16,
      trend_entry_mom: 0.008,
      trend_confirm_mom: 0.003,
      trend_range_floor: 0.45,
      mr_zscore_window: 16,
      mr_zscore_entry: 1.1,
      breakout_window: 12,
      breakout_buffer: 0.002,
      breakout_mom_period: 2,
      trend_weight: 1.0,
      mean_revert_weight: 1.35,
      breakout_weight: 0.9,
      consensus_entry_threshold: 1.15,
      consensus_negative_threshold: -0.1,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter54CParams;
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

  private consensusScore(series: TokenSeries, bar: Bar, support: number, resistance: number): number | null {
    const trendShort = momentum(series.closes, this.params.trend_short_mom_period);
    const trendLong = momentum(series.closes, this.params.trend_long_mom_period);
    const breakoutMom = momentum(series.closes, this.params.breakout_mom_period);
    const z = rollingZScore(series.closes, this.params.mr_zscore_window);
    if (trendShort === null || trendLong === null || breakoutMom === null || z === null) return null;

    const rangeDenom = Math.max(1e-6, resistance - support);
    const rangePosition = (bar.close - support) / rangeDenom;

    const trendUp = trendLong > this.params.trend_entry_mom && trendShort > this.params.trend_confirm_mom && rangePosition > this.params.trend_range_floor;
    const trendDown = trendLong < -this.params.trend_entry_mom && trendShort < -this.params.trend_confirm_mom;
    const trendVote = signVote(trendUp, trendDown);

    const mrLong = z <= -this.params.mr_zscore_entry && nearSupport(bar.low, support, this.params.support_buffer);
    const mrShort = z >= this.params.mr_zscore_entry && bar.high >= resistance * 0.995;
    const meanRevertVote = signVote(mrLong, mrShort);

    if (series.highs.length < this.params.breakout_window + 1 || series.lows.length < this.params.breakout_window + 1) {
      return null;
    }
    const priorHigh = Math.max(...series.highs.slice(-(this.params.breakout_window + 1), -1));
    const priorLow = Math.min(...series.lows.slice(-(this.params.breakout_window + 1), -1));
    const breakUp = bar.close >= priorHigh * (1 + this.params.breakout_buffer) && breakoutMom > 0;
    const breakDown = bar.close <= priorLow * (1 - this.params.breakout_buffer) && breakoutMom < 0;
    const breakoutVote = signVote(breakUp, breakDown);

    return (
      trendVote * this.params.trend_weight +
      meanRevertVote * this.params.mean_revert_weight +
      breakoutVote * this.params.breakout_weight
    );
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (!sr || shouldSkipPrice(bar.close)) return;

    const consensus = this.consensusScore(series, bar, sr.support, sr.resistance);
    if (consensus === null) return;

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * 0.985;
      const maxHoldReached = barNum - entryBar >= this.params.max_hold_bars;
      const consensusFlipNegative = consensus <= this.params.consensus_negative_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || consensusFlipNegative) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const supportProximityPass = nearSupport(bar.low, sr.support, this.params.support_buffer);
    if (consensus >= this.params.consensus_entry_threshold && supportProximityPass) {
      this.open(ctx, bar, barNum);
    }
  }
}
