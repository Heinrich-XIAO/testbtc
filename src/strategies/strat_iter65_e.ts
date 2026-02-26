import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  returns: number[];
  stoch: number[];
  orderFlowScores: number[];
  cumulativeDelta: number;
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

function computeOrderFlowImbalance(
  closes: number[],
  highs: number[],
  lows: number[],
  volumes: number[],
  lookback: number
): { score: number; delta: number } {
  if (closes.length < lookback || volumes.length < lookback) {
    return { score: 0.5, delta: 0 };
  }

  const subsetClose = closes.slice(-lookback);
  const subsetHigh = highs.slice(-lookback);
  const subsetLow = lows.slice(-lookback);
  const subsetVol = volumes.slice(-lookback);

  let cumulativeDelta = 0;
  let buyVolume = 0;
  let sellVolume = 0;

  for (let i = 0; i < subsetClose.length; i++) {
    const close = subsetClose[i];
    const high = subsetHigh[i];
    const low = subsetLow[i];
    const vol = subsetVol[i] || 1;

    const range = high - low;
    if (range === 0) continue;

    const upperHalf = (close - low) / range;
    
    const buyStrength = upperHalf;
    const sellStrength = 1 - upperHalf;

    const buyVol = vol * buyStrength;
    const sellVol = vol * sellStrength;

    buyVolume += buyVol;
    sellVolume += sellVol;

    cumulativeDelta += buyVol - sellVol;
  }

  const totalVolume = buyVolume + sellVolume;
  if (totalVolume === 0) return { score: 0.5, delta: 0 };

  const imbalance = (buyVolume - sellVolume) / totalVolume;
  
  const avgVolume = subsetVol.reduce((a, b) => a + b, 0) / subsetVol.length;
  const volumeRatio = avgVolume > 0 ? (subsetVol[subsetVol.length - 1] / avgVolume) : 1;
  
  let score = 0.5;
  if (imbalance > 0.1) {
    score = 0.5 + Math.min(imbalance * 0.5, 0.4);
  } else if (imbalance < -0.1) {
    score = 0.5 + Math.max(imbalance * 0.5, -0.4);
  }
  
  score *= Math.min(volumeRatio, 2);

  return { score, delta: cumulativeDelta };
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

export interface StratIter65EParams extends StrategyParams {
  orderflow_lookback: number;
  orderflow_score_threshold: number;
  orderflow_delta_threshold: number;
  momentum_lookback: number;
  momentum_threshold: number;
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

export class StratIter65EStrategy implements Strategy {
  params: StratIter65EParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter65EParams> = {}) {
    const saved = loadSavedParams<StratIter65EParams>('strat_iter65_e.params.json');
    this.params = {
      orderflow_lookback: 20,
      orderflow_score_threshold: 0.65,
      orderflow_delta_threshold: 0,
      momentum_lookback: 15,
      momentum_threshold: 0.01,
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
    } as StratIter65EParams;
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
      stoch: [],
      orderFlowScores: [],
      cumulativeDelta: 0,
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeOrderFlow(s: TokenState): void {
    const lookback = Math.floor(this.params.orderflow_lookback);
    
    if (s.closes.length >= lookback && s.volumes.length >= lookback) {
      const { score, delta } = computeOrderFlowImbalance(
        s.closes,
        s.highs,
        s.lows,
        s.volumes,
        lookback
      );
      capPush(s.orderFlowScores, score);
      s.cumulativeDelta = delta;
    }
  }

  private computeMomentum(closes: number[], lookback: number): number {
    if (closes.length < lookback + 1) return 0;
    
    const recent = closes.slice(-lookback);
    const older = closes.slice(-(lookback + 1), -1);
    
    if (recent.length === 0 || older.length === 0) return 0;
    
    const recentReturn = (recent[recent.length - 1] - recent[0]) / recent[0];
    const olderReturn = (older[older.length - 1] - older[0]) / older[0];
    
    return recentReturn - olderReturn;
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
    capPush(s.volumes, 1 + Math.abs(ret) * 100);
    capPush(s.returns, ret, 800);

    this.computeOrderFlow(s);

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

    if (k === null || s.stoch.length < 2 || s.orderFlowScores.length < 3) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const orderFlowScore = s.orderFlowScores[s.orderFlowScores.length - 1];
    const orderFlowValid = orderFlowScore > this.params.orderflow_score_threshold;

    const deltaValid = s.cumulativeDelta > this.params.orderflow_delta_threshold;

    const momentum = this.computeMomentum(s.closes, this.params.momentum_lookback);
    const momentumValid = momentum > this.params.momentum_threshold;

    if (nearSupport && supportReclaim && stochRebound && orderFlowValid && deltaValid && momentumValid) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
