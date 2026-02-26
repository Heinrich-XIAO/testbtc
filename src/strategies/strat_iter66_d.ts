import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  returns: number[];
  tdValue: number[];
  tdEligibility: number[];
  stoch: number[];
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

function computeTDLambda(
  returns: number[],
  lambda: number,
  alpha: number,
  gamma: number,
  previousValue: number,
  previousEligibility: number
): { value: number; eligibility: number } {
  if (returns.length < 2) {
    return { value: previousValue, eligibility: previousEligibility };
  }
  
  const ret = returns[returns.length - 1];
  const reward = Math.abs(ret) > 0.001 ? (ret > 0 ? 1 : -1) : 0;
  
  const tdError = reward + gamma * previousValue - previousValue;
  
  const newEligibility = gamma * lambda * previousEligibility + 1;
  const newValue = previousValue + alpha * tdError * newEligibility;
  
  return { 
    value: Math.min(Math.max(newValue, -1), 1), 
    eligibility: Math.min(Math.max(newEligibility, 0), 10) 
  };
}

function computeValueSignal(closes: number[], returns: number[], lookback: number, lambda: number, alpha: number, gamma: number): number {
  if (returns.length < lookback || closes.length < lookback) return 0;
  
  let value = 0;
  let eligibility = 1;
  
  for (let i = Math.max(0, returns.length - lookback); i < returns.length; i++) {
    const subset = returns.slice(0, i + 1);
    const result = computeTDLambda(subset, lambda, alpha, gamma, value, eligibility);
    value = result.value;
    eligibility = result.eligibility;
  }
  
  return (value + 1) / 2;
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

export interface StratIter66DParams extends StrategyParams {
  td_lookback: number;
  td_lambda: number;
  td_alpha: number;
  td_gamma: number;
  td_low: number;
  td_high: number;
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

export class StratIter66DStrategy implements Strategy {
  params: StratIter66DParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter66DParams> = {}) {
    const saved = loadSavedParams<StratIter66DParams>('strat_iter66_d.params.json');
    this.params = {
      td_lookback: 30,
      td_lambda: 0.8,
      td_alpha: 0.1,
      td_gamma: 0.95,
      td_low: 0.25,
      td_high: 0.70,
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
    } as StratIter66DParams;
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
      volumes: [],
      returns: [],
      tdValue: [],
      tdEligibility: [],
      stoch: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeTDIndicators(s: TokenState): void {
    const lb = Math.floor(this.params.td_lookback);
    const lambda = this.params.td_lambda;
    const alpha = this.params.td_alpha;
    const gamma = this.params.td_gamma;
    
    if (s.returns.length >= lb) {
      let prevValue = s.tdValue.length > 0 ? s.tdValue[s.tdValue.length - 1] : 0;
      let prevElig = s.tdEligibility.length > 0 ? s.tdEligibility[s.tdEligibility.length - 1] : 1;
      
      const result = computeTDLambda(s.returns, lambda, alpha, gamma, prevValue, prevElig);
      capPush(s.tdValue, result.value);
      capPush(s.tdEligibility, result.eligibility);
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

    this.computeTDIndicators(s);

    const k = stochK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));
    if (k !== null) {
      s.stoch = s.stoch || [];
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

    if (k === null || !s.stoch || s.stoch.length < 2 || s.tdValue.length < 3) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const tdVal = (s.tdValue[s.tdValue.length - 1] + 1) / 2;
    const tdAvg = s.tdValue.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const tdNormalized = (tdAvg + 1) / 2;
    const tdValid = tdNormalized >= 0.3;

    if (nearSupport && supportReclaim && stochRebound && tdValid) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
