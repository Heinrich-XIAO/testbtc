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

type PanicBar = {
  barNum: number;
  low: number;
  high: number;
  close: number;
  range: number;
  panicScore: number;
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

export interface StratIter57BParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  panic_window: number;
  burst_return_threshold: number;
  burst_vs_avg_multiplier: number;
  range_climax_multiplier: number;
  close_near_low_max: number;
  followthrough_drop_threshold: number;
  panic_entry_threshold: number;
  stabilization_reclaim_ratio: number;
  stabilization_hold_ratio: number;
  stabilization_close_rebound: number;
  stabilization_range_ratio_max: number;
  renewed_panic_exit_threshold: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter57BStrategy implements Strategy {
  params: StratIter57BParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private lastPanic: Map<string, PanicBar> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter57BParams> = {}) {
    const saved = loadSavedParams<StratIter57BParams>('strat_iter57_b.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.018,
      panic_window: 20,
      burst_return_threshold: 0.014,
      burst_vs_avg_multiplier: 2.2,
      range_climax_multiplier: 2.0,
      close_near_low_max: 0.38,
      followthrough_drop_threshold: 0.006,
      panic_entry_threshold: 2.7,
      stabilization_reclaim_ratio: 0.6,
      stabilization_hold_ratio: 0.02,
      stabilization_close_rebound: 0.003,
      stabilization_range_ratio_max: 1.0,
      renewed_panic_exit_threshold: 2.9,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter57BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number; barReturn: number } {
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

    const s = this.series.get(bar.tokenId)!;
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;
    const barReturn = prevClose && prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;

    capPush(s.opens, bar.open);
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    capPush(s.ranges, Math.max(0, bar.high - bar.low));
    if (prevClose && prevClose > 0) capPush(s.returns, barReturn);

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum, barReturn };
  }

  private computePanicScore(series: TokenSeries, bar: Bar, barReturn: number): number | null {
    const window = Math.max(8, Math.round(this.params.panic_window));
    if (series.returns.length < window || series.ranges.length < window) return null;

    const absReturns = series.returns.slice(-window).map((v) => Math.abs(v));
    const avgAbsReturn = Math.max(1e-6, mean(absReturns));
    const avgRange = Math.max(1e-6, mean(series.ranges.slice(-window)));

    const downsideBurst = Math.max(0, (-barReturn - this.params.burst_return_threshold) / Math.max(1e-6, this.params.burst_return_threshold));
    const burstVsAvg = Math.max(0, (-barReturn) / avgAbsReturn - this.params.burst_vs_avg_multiplier);
    const rangeClimax = Math.max(0, (bar.high - bar.low) / avgRange - this.params.range_climax_multiplier);

    const barRange = Math.max(1e-9, bar.high - bar.low);
    const closePos = (bar.close - bar.low) / barRange;
    const nearLowPenalty = Math.max(0, this.params.close_near_low_max - closePos) / Math.max(1e-6, this.params.close_near_low_max);

    const followthrough =
      series.closes.length >= 3
        ? Math.max(0, (series.closes[series.closes.length - 2] - series.closes[series.closes.length - 1]) / Math.max(1e-9, series.closes[series.closes.length - 2]) - this.params.followthrough_drop_threshold)
        : 0;

    return downsideBurst * 1.15 + burstVsAvg * 0.9 + rangeClimax * 0.85 + nearLowPenalty * 0.75 + followthrough * 45;
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
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (!sr || shouldSkipPrice(bar.close)) return;

    const panicScore = this.computePanicScore(series, bar, barReturn);
    if (panicScore !== null && panicScore >= this.params.panic_entry_threshold) {
      this.lastPanic.set(bar.tokenId, {
        barNum,
        low: bar.low,
        high: bar.high,
        close: bar.close,
        range: Math.max(1e-9, bar.high - bar.low),
        panicScore,
      });
    }

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
      const renewedPanic = panicScore !== null && panicScore >= this.params.renewed_panic_exit_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || renewedPanic) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const panic = this.lastPanic.get(bar.tokenId);
    if (!panic || panic.barNum !== barNum - 1) return;

    const closeReclaimLevel = panic.low + panic.range * this.params.stabilization_reclaim_ratio;
    const heldPanicLow = bar.low >= panic.low * (1 - this.params.stabilization_hold_ratio);
    const closeReclaimed = bar.close >= closeReclaimLevel;
    const closeRebound = bar.close >= panic.close * (1 + this.params.stabilization_close_rebound);
    const currentRange = Math.max(1e-9, bar.high - bar.low);
    const nonExpandingRange = currentRange <= panic.range * this.params.stabilization_range_ratio_max;
    const nearSupport = Math.min(bar.low, panic.low) <= sr.support * (1 + this.params.support_buffer);

    if (heldPanicLow && closeReclaimed && closeRebound && nonExpandingRange && nearSupport) {
      this.open(ctx, bar, barNum);
    }
  }
}
