import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  imf1: number[];
  imf2: number[];
  imf1_energy: number;
  imf2_energy: number;
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

function findExtrema(values: number[]): { max: number[]; min: number[] } {
  const max: number[] = [];
  const min: number[] = [];
  
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] > values[i + 1]) {
      max.push(i);
    }
    if (values[i] < values[i - 1] && values[i] < values[i + 1]) {
      min.push(i);
    }
  }
  
  return { max, min };
}

function siftingIteration(values: number[], maxIdx: number[], minIdx: number[]): number[] {
  const upper: number[] = [];
  const lower: number[] = [];
  
  if (maxIdx.length < 2 || minIdx.length < 2) {
    return values;
  }
  
  for (let i = 0; i < values.length; i++) {
    let upperEnv = values[0];
    let lowerEnv = values[0];
    
    const lastMax = maxIdx[maxIdx.length - 1];
    const lastMin = minIdx[minIdx.length - 1];
    
    if (i <= lastMax) {
      const relevantMax = maxIdx.filter(idx => idx <= i);
      if (relevantMax.length >= 2) {
        const x1 = relevantMax[relevantMax.length - 2];
        const x2 = relevantMax[relevantMax.length - 1];
        const t = (i - x1) / (x2 - x1);
        upperEnv = values[x1] + t * (values[x2] - values[x1]);
      }
    }
    
    if (i <= lastMin) {
      const relevantMin = minIdx.filter(idx => idx <= i);
      if (relevantMin.length >= 2) {
        const x1 = relevantMin[relevantMin.length - 2];
        const x2 = relevantMin[relevantMin.length - 1];
        const t = (i - x1) / (x2 - x1);
        lowerEnv = values[x1] + t * (values[x2] - values[x1]);
      }
    }
    
    upper.push(upperEnv);
    lower.push(lowerEnv);
  }
  
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    result.push((upper[i] + lower[i]) / 2);
  }
  
  return result;
}

function extractIMF(values: number[], maxIterations: number): number[] {
  let h = [...values];
  
  for (let iter = 0; iter < maxIterations; iter++) {
    const { max, min } = findExtrema(h);
    
    if (max.length < 2 || min.length < 2) {
      break;
    }
    
    const newH = siftingIteration(h, max, min);
    
    let diff = 0;
    for (let i = 0; i < h.length; i++) {
      diff += Math.abs(newH[i] - h[i]);
    }
    
    if (diff / h.length < 0.001) {
      return newH;
    }
    
    h = newH;
  }
  
  return h;
}

function computeIMFDecomposition(closes: number[], lookback: number): { imf1: number[]; imf2: number[] } {
  if (closes.length < lookback) {
    return { imf1: [], imf2: [] };
  }
  
  const subset = closes.slice(-lookback);
  
  const imf1 = extractIMF(subset, 5);
  
  const residual: number[] = [];
  for (let i = 0; i < subset.length; i++) {
    residual.push(subset[i] - (imf1[i] || 0));
  }
  
  const imf2 = extractIMF(residual, 5);
  
  return { imf1, imf2 };
}

function computeEnergy(signal: number[]): number {
  return signal.reduce((sum, val) => sum + val * val, 0) / signal.length;
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

export interface StratIter64EParams extends StrategyParams {
  imf_lookback: number;
  imf_energy_ratio_threshold: number;
  imf_trend_threshold: number;
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

export class StratIter64EStrategy implements Strategy {
  params: StratIter64EParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter64EParams> = {}) {
    const saved = loadSavedParams<StratIter64EParams>('strat_iter64_e.params.json');
    this.params = {
      imf_lookback: 40,
      imf_energy_ratio_threshold: 0.6,
      imf_trend_threshold: 0.01,
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
    } as StratIter64EParams;
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
      imf1: [],
      imf2: [],
      imf1_energy: 0,
      imf2_energy: 0,
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeIMF(s: TokenState): void {
    const lookback = Math.floor(this.params.imf_lookback);
    if (s.closes.length < lookback) return;

    const { imf1, imf2 } = computeIMFDecomposition(s.closes, lookback);
    
    capPush(s.imf1, imf1[imf1.length - 1] || 0);
    capPush(s.imf2, imf2[imf2.length - 1] || 0);
    
    if (imf1.length > 0 && imf2.length > 0) {
      s.imf1_energy = computeEnergy(imf1);
      s.imf2_energy = computeEnergy(imf2);
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

    this.computeIMF(s);

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

    if (k === null || s.stoch.length < 2 || s.imf1.length < 2) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const energyRatio = s.imf2_energy > 0 ? s.imf1_energy / s.imf2_energy : 1;
    const imfStable = energyRatio > this.params.imf_energy_ratio_threshold;

    const imfTrend = s.imf1.length >= 2 ? s.imf1[s.imf1.length - 1] - s.imf1[s.imf1.length - 2] : 0;
    const imfTrending = imfTrend > this.params.imf_trend_threshold;

    if (nearSupport && supportReclaim && stochRebound && imfStable && imfTrending) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
