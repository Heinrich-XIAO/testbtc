import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  divergence: number[];
  barNum: number;
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

function capPush(values: number[], value: number, max = 1200): void {
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

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

function euclidean(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum / n);
}

function maxLast(values: number[], n: number): number {
  if (values.length === 0) return 0;
  const count = Math.max(1, Math.floor(n));
  return Math.max(...values.slice(-count));
}

export interface StratIter62AParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_rebound_delta: number;
  trajectory_embed_len: number;
  divergence_horizon: number;
  divergence_window: number;
  neighbor_tolerance: number;
  min_pair_count: number;
  divergence_spike_threshold: number;
  collapse_lookback: number;
  divergence_cool_ratio: number;
  divergence_drop_min: number;
  divergence_reaccel_delta: number;
  divergence_reaccel_threshold: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter62AStrategy implements Strategy {
  params: StratIter62AParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter62AParams> = {}) {
    const saved = loadSavedParams<StratIter62AParams>('strat_iter62_a.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stoch_rebound_delta: 4,
      trajectory_embed_len: 4,
      divergence_horizon: 3,
      divergence_window: 28,
      neighbor_tolerance: 0.010,
      min_pair_count: 6,
      divergence_spike_threshold: 0.22,
      collapse_lookback: 4,
      divergence_cool_ratio: 0.62,
      divergence_drop_min: 0.05,
      divergence_reaccel_delta: 0.06,
      divergence_reaccel_threshold: 0.18,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter62AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private getState(tokenId: string): TokenState {
    let s = this.state.get(tokenId);
    if (s) return s;

    s = {
      closes: [],
      highs: [],
      lows: [],
      returns: [],
      stoch: [],
      divergence: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private estimateLocalDivergence(returns: number[]): number | null {
    const embed = Math.max(2, Math.floor(this.params.trajectory_embed_len));
    const horizon = Math.max(1, Math.floor(this.params.divergence_horizon));
    const window = Math.max(8, Math.floor(this.params.divergence_window));
    const tolerance = Math.max(1e-6, this.params.neighbor_tolerance);

    const minRequired = embed + horizon + 6;
    if (returns.length < minRequired) return null;

    const endAnchor = returns.length - horizon - 1;
    const startAnchor = Math.max(embed - 1, endAnchor - window + 1);
    if (endAnchor - startAnchor < 2) return null;

    const lyaps: number[] = [];
    const eps = 1e-9;

    for (let i = startAnchor; i <= endAnchor; i++) {
      const vecI0 = returns.slice(i - embed + 1, i + 1);
      const vecI1 = returns.slice(i - embed + 1 + horizon, i + 1 + horizon);
      for (let j = i + 1; j <= endAnchor; j++) {
        const vecJ0 = returns.slice(j - embed + 1, j + 1);
        const d0 = euclidean(vecI0, vecJ0);
        if (d0 <= eps || d0 > tolerance) continue;

        const vecJ1 = returns.slice(j - embed + 1 + horizon, j + 1 + horizon);
        const d1 = euclidean(vecI1, vecJ1);
        const lyapLike = Math.log((d1 + eps) / (d0 + eps)) / horizon;
        lyaps.push(lyapLike);
      }
    }

    if (lyaps.length < Math.max(2, Math.floor(this.params.min_pair_count))) return null;
    return lyaps.reduce((sum, v) => sum + v, 0) / lyaps.length;
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
    if (shouldSkipPrice(bar.close)) return;

    const s = this.getState(bar.tokenId);
    s.barNum += 1;

    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;
    const ret = prevClose && prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    capPush(s.returns, ret, 800);

    const k = stochK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));
    if (k !== null) capPush(s.stoch, k, 800);

    const div = this.estimateLocalDivergence(s.returns);
    if (div !== null) capPush(s.divergence, div, 800);

    const sr = priorSupportResistance(s.highs, s.lows, this.params.sr_lookback);
    if (!sr) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = s.barNum - enteredBar >= this.params.max_hold_bars;

      const dLen = s.divergence.length;
      const currDiv = dLen > 0 ? s.divergence[dLen - 1] : 0;
      const prevDiv = dLen > 1 ? s.divergence[dLen - 2] : currDiv;
      const divergenceReaccel =
        currDiv >= this.params.divergence_reaccel_threshold &&
        currDiv - prevDiv >= this.params.divergence_reaccel_delta;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || divergenceReaccel) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (k === null || s.stoch.length < 2 || s.divergence.length < 2) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);

    const currDiv = s.divergence[s.divergence.length - 1];
    const priorDiv = s.divergence.slice(0, -1);
    const spike = maxLast(priorDiv, this.params.collapse_lookback);
    const cooled =
      spike >= this.params.divergence_spike_threshold &&
      currDiv <= spike * this.params.divergence_cool_ratio &&
      spike - currDiv >= this.params.divergence_drop_min;

    if (nearSupport && supportReclaim && stochRebound && cooled) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
