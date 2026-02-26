import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  returns: number[];
  kalmanState: number[];
  kalmanVariance: number[];
  innovationChi2: number[];
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

function kalmanFilterUpdate(prevState: number, prevVariance: number, q: number, r: number, measurement: number): { state: number; variance: number; innovation: number } {
  const prediction = prevState;
  const predictionVariance = prevVariance + q;
  
  const innovation = measurement - prediction;
  const innovationVariance = predictionVariance + r;
  
  const kalmanGain = predictionVariance / innovationVariance;
  
  const state = prediction + kalmanGain * innovation;
  const variance = (1 - kalmanGain) * predictionVariance;
  
  return { 
    state, 
    variance: Math.max(Math.abs(variance), 0.0001), 
    innovation: Math.abs(innovation)
  };
}

function computeChiSquare(innovations: number[], variances: number[], window: number): number {
  if (innovations.length < window || variances.length < window) return 0;
  
  const recentInnovations = innovations.slice(-window);
  const recentVariances = variances.slice(-window);
  
  let chiSq = 0;
  for (let i = 0; i < recentInnovations.length; i++) {
    const z = recentInnovations[i];
    const sigma2 = recentVariances[i];
    chiSq += (z * z) / sigma2;
  }
  
  return chiSq / window;
}

function computeKalmanIndicators(closes: number[], q: number, r: number, window: number): { state: number; chi2: number } {
  if (closes.length < 15) return { state: 0, chi2: 0.3 };
  
  const lookback = Math.min(30, closes.length);
  const subset = closes.slice(-lookback);
  
  let state = subset[0];
  let variance = 1;
  let chiSum = 0;
  
  for (let i = 1; i < subset.length; i++) {
    const result = kalmanFilterUpdate(state, variance, q, r, subset[i]);
    state = result.state;
    variance = result.variance;
    
    const z = result.innovation;
    const sigma2 = result.variance;
    chiSum += (z * z) / sigma2;
  }
  
  const chi2 = chiSum / subset.length;
  
  return { state, chi2 };
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

export interface StratIter66EParams extends StrategyParams {
  kalman_q: number;
  kalman_r: number;
  chi2_window: number;
  chi2_low: number;
  chi2_high: number;
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

export class StratIter66EStrategy implements Strategy {
  params: StratIter66EParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter66EParams> = {}) {
    const saved = loadSavedParams<StratIter66EParams>('strat_iter66_e.params.json');
    this.params = {
      kalman_q: 0.01,
      kalman_r: 0.1,
      chi2_window: 10,
      chi2_low: 0.3,
      chi2_high: 1.2,
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
    } as StratIter66EParams;
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
      kalmanState: [],
      kalmanVariance: [],
      innovationChi2: [],
      stoch: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeKalmanIndicators(s: TokenState): void {
    if (s.closes.length >= 15) {
      const cw = Math.floor(this.params.chi2_window);
      const q = this.params.kalman_q;
      const r = this.params.kalman_r;
      
      const result = computeKalmanIndicators(s.closes, q, r, cw);
      capPush(s.kalmanState, result.state);
      capPush(s.innovationChi2, result.chi2);
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

    this.computeKalmanIndicators(s);

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

    if (k === null || !s.stoch || s.stoch.length < 2 || s.innovationChi2.length < 3) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const chi2 = s.innovationChi2[s.innovationChi2.length - 1];
    const chi2Avg = s.innovationChi2.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const chi2Valid = chi2 >= this.params.chi2_low || chi2Avg >= this.params.chi2_low || s.innovationChi2.length < 5;

    if (nearSupport && supportReclaim && stochRebound && chi2Valid) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
