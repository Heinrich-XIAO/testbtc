import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  recurrenceCount: number[];
  avgRecurrence: number;
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

function computeLocalRecurrence(closes: number[], lookback: number, threshold: number): number {
  if (closes.length < lookback) return 0;
  
  const subset = closes.slice(-lookback);
  const current = subset[subset.length - 1];
  let count = 0;
  
  for (let i = 0; i < subset.length - 1; i++) {
    if (Math.abs(subset[i] - current) <= threshold * current) {
      count++;
    }
  }
  
  return count / (lookback - 1);
}

function computeRecurrenceRate(returns: number[], lookback: number): number {
  if (returns.length < lookback) return 0;
  
  const subset = returns.slice(-lookback);
  let sameSign = 0;
  
  for (let i = 1; i < subset.length; i++) {
    if ((subset[i] >= 0 && subset[i-1] >= 0) || (subset[i] < 0 && subset[i-1] < 0)) {
      sameSign++;
    }
  }
  
  return sameSign / (lookback - 1);
}

function priorSupport(highs: number[], lows: number[], lookback: number): number | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return Math.min(...lows.slice(-(lookback + 1), -1));
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

export interface StratIter64AParams extends StrategyParams {
  rec_lookback: number;
  rec_threshold: number;
  rec_rate_threshold: number;
  rec_rate_low: number;
  lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stoch_rebound_delta: number;
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter64AStrategy implements Strategy {
  params: StratIter64AParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter64AParams> = {}) {
    const saved = loadSavedParams<StratIter64AParams>('strat_iter64_a.params.json');
    this.params = {
      rec_lookback: 20,
      rec_threshold: 0.015,
      rec_rate_threshold: 0.55,
      rec_rate_low: 0.45,
      lookback: 30,
      stoch_k_period: 14,
      stoch_oversold: 16,
      stoch_overbought: 84,
      stoch_rebound_delta: 3,
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter64AParams;
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
      recurrenceCount: [],
      avgRecurrence: 0.5,
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeRecurrence(s: TokenState): void {
    const lookback = Math.floor(this.params.rec_lookback);
    if (s.closes.length < lookback) return;

    const threshold = this.params.rec_threshold;
    const recRate = computeLocalRecurrence(s.closes, lookback, threshold);
    
    capPush(s.recurrenceCount, recRate);
    
    if (s.recurrenceCount.length >= 5) {
      s.avgRecurrence = s.recurrenceCount.slice(-5).reduce((a, b) => a + b, 0) / 5;
    }
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

    this.computeRecurrence(s);

    const k = stochK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));
    if (k !== null) {
      s.stoch.push(k);
      if (s.stoch.length > 100) s.stoch.shift();
    }

    const sr = priorSupport(s.highs, s.lows, this.params.sr_lookback);
    if (!sr) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const maxHoldReached = s.barNum - enteredBar >= this.params.max_hold_bars;

      if (stopLossHit || profitTargetHit || maxHoldReached) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (k === null || s.stoch.length < 2 || s.recurrenceCount.length < 3) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const recLow = s.avgRecurrence < this.params.rec_rate_low;
    const recStable = s.recurrenceCount[s.recurrenceCount.length - 1] > this.params.rec_rate_threshold;

    if (nearSupport && supportReclaim && stochRebound && recLow && recStable) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
