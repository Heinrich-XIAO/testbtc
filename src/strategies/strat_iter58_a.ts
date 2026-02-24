import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  supportTouches: number[];
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

function recurrenceRateProxy(closes: number[], window: number, epsilon: number): number | null {
  const safeWindow = Math.max(16, Math.floor(window));
  const eps = Math.max(0.005, epsilon);
  if (closes.length < safeWindow) return null;

  const sample = closes.slice(-safeWindow);
  const lo = Math.min(...sample);
  const hi = Math.max(...sample);
  const denom = Math.max(1e-9, hi - lo);

  const states = sample.map((v) => (v - lo) / denom);
  const n = states.length;

  let recurrentPairs = 0;
  let totalPairs = 0;

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      totalPairs += 1;
      if (Math.abs(states[i] - states[j]) <= eps) recurrentPairs += 1;
    }
  }

  if (totalPairs === 0) return null;
  return recurrentPairs / totalPairs;
}

function sumLast(values: number[], count: number): number {
  if (values.length === 0 || count <= 0) return 0;
  const slice = values.slice(-Math.max(1, Math.floor(count)));
  return slice.reduce((acc, v) => acc + v, 0);
}

export interface StratIter58AParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  rebound_lookback: number;
  min_support_touches: number;
  min_rebound_return: number;
  rr_window: number;
  rr_epsilon: number;
  rr_low_threshold: number;
  rr_moderate_min: number;
  rr_moderate_max: number;
  rr_transition_delta: number;
  rr_collapse_threshold: number;
  rr_drop_from_entry: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter58AStrategy implements Strategy {
  params: StratIter58AParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private prevRr: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private entryRr: Map<string, number> = new Map();

  constructor(params: Partial<StratIter58AParams> = {}) {
    const saved = loadSavedParams<StratIter58AParams>('strat_iter58_a.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      support_reclaim_buffer: 0.005,
      rebound_lookback: 8,
      min_support_touches: 1,
      min_rebound_return: 0.002,
      rr_window: 44,
      rr_epsilon: 0.08,
      rr_low_threshold: 0.10,
      rr_moderate_min: 0.16,
      rr_moderate_max: 0.40,
      rr_transition_delta: 0.025,
      rr_collapse_threshold: 0.08,
      rr_drop_from_entry: 0.07,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter58AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], supportTouches: [] });
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

  private open(ctx: BacktestContext, bar: Bar, barNum: number, rr: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;

    const result = ctx.buy(bar.tokenId, size);
    if (!result.success) return false;

    this.entryPrice.set(bar.tokenId, bar.close);
    this.entryBar.set(bar.tokenId, barNum);
    this.entryRr.set(bar.tokenId, rr);
    return true;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.entryRr.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (shouldSkipPrice(bar.close)) return;

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr) return;

    const rr = recurrenceRateProxy(series.closes, this.params.rr_window, this.params.rr_epsilon);
    if (rr === null) return;

    const prevRr = this.prevRr.get(bar.tokenId) ?? rr;
    this.prevRr.set(bar.tokenId, rr);

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    capPush(series.supportTouches, nearSupport ? 1 : 0);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      const enteredRr = this.entryRr.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined || enteredRr === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
      const recurrenceCollapsed =
        rr <= this.params.rr_collapse_threshold ||
        rr <= enteredRr - this.params.rr_drop_from_entry;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || recurrenceCollapsed) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const prevClose = series.closes.length >= 2 ? series.closes[series.closes.length - 2] : null;
    if (prevClose === null || prevClose <= 0) return;

    const supportTouches = sumLast(series.supportTouches, this.params.rebound_lookback);
    const hasSupportReboundHistory = supportTouches >= this.params.min_support_touches;
    const reclaimedSupport = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);
    const reboundReturn = (bar.close - prevClose) / prevClose;
    const reboundStrength = reboundReturn >= this.params.min_rebound_return && bar.close >= bar.open;

    const recurrenceTransition =
      prevRr <= this.params.rr_low_threshold &&
      rr >= this.params.rr_moderate_min &&
      rr <= this.params.rr_moderate_max &&
      rr - prevRr >= this.params.rr_transition_delta;

    if (hasSupportReboundHistory && reclaimedSupport && reboundStrength && recurrenceTransition) {
      this.open(ctx, bar, barNum, rr);
    }
  }
}
