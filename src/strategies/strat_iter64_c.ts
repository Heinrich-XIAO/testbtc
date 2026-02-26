import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  ma_fast: number[];
  ma_slow: number[];
  spread: number[];
  hedgeRatio: number;
  zScore: number;
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

function computeHedgeRatio(closes1: number[], closes2: number[], lookback: number): number {
  const n = Math.min(closes1.length, closes2.length, lookback);
  if (n < 10) return 1;
  
  const c1 = closes1.slice(-n);
  const c2 = closes2.slice(-n);
  
  let sum1 = 0, sum2 = 0, sum12 = 0, sum22 = 0;
  for (let i = 0; i < n; i++) {
    sum1 += c1[i];
    sum2 += c2[i];
    sum12 += c1[i] * c2[i];
    sum22 += c2[i] * c2[i];
  }
  
  const mean1 = sum1 / n;
  const mean2 = sum2 / n;
  const cov = sum12 / n - mean1 * mean2;
  const var2 = sum22 / n - mean2 * mean2;
  
  return var2 > 0 ? cov / var2 : 1;
}

function computeSpread(price: number, maValue: number, hedgeRatio: number): number {
  return price - hedgeRatio * maValue;
}

function computeZScore(spread: number[], lookback: number): number {
  if (spread.length < lookback) return 0;
  const recent = spread.slice(-lookback);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const std = Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length);
  return std > 0 ? (spread[spread.length - 1] - mean) / std : 0;
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

export interface StratIter64CParams extends StrategyParams {
  coin_lookback: number;
  coin_z_threshold: number;
  coin_z_exit: number;
  coin_hedge_window: number;
  fast_ma_period: number;
  slow_ma_period: number;
  spread_ma_period: number;
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

export class StratIter64CStrategy implements Strategy {
  params: StratIter64CParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter64CParams> = {}) {
    const saved = loadSavedParams<StratIter64CParams>('strat_iter64_c.params.json');
    this.params = {
      coin_lookback: 35,
      coin_z_threshold: 1.8,
      coin_z_exit: 0.4,
      coin_hedge_window: 40,
      fast_ma_period: 8,
      slow_ma_period: 20,
      spread_ma_period: 15,
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
    } as StratIter64CParams;
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
      ma_fast: [],
      ma_slow: [],
      spread: [],
      hedgeRatio: 1,
      zScore: 0,
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeCointegration(s: TokenState): void {
    const lookback = Math.floor(this.params.coin_hedge_window);
    if (s.closes.length < lookback + 10) return;

    const closes = s.closes.slice(-lookback - 10);
    const fastP = Math.floor(this.params.fast_ma_period);
    const slowP = Math.floor(this.params.slow_ma_period);
    
    if (closes.length < slowP) return;
    
    const fastMA = closes.slice(-fastP).reduce((a, b) => a + b, 0) / fastP;
    const slowMA = closes.slice(-slowP).reduce((a, b) => a + b, 0) / slowP;
    
    s.hedgeRatio = computeHedgeRatio(closes, closes, lookback);
    
    const spreadVal = computeSpread(fastMA, slowMA, s.hedgeRatio);
    capPush(s.spread, spreadVal);
    
    const zLookback = Math.floor(this.params.spread_ma_period);
    s.zScore = computeZScore(s.spread, zLookback);
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

    this.computeCointegration(s);

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
      
      const meanRevExit = Math.abs(s.zScore) < this.params.coin_z_exit;

      if (stopLossHit || profitTargetHit || maxHoldReached || meanRevExit) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (k === null || s.stoch.length < 2 || s.spread.length < 5) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const spreadDeviates = Math.abs(s.zScore) > this.params.coin_z_threshold;

    if (nearSupport && supportReclaim && stochRebound && spreadDeviates) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
