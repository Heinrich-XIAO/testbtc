import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  returns: number[];
  quantumProbs: number[];
  diffusionState: number;
  pricePositions: number[];
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

function computeQuantumProbability(closes: number[], lookback: number, numBins: number): number {
  if (closes.length < lookback) return 0.5;
  
  const subset = closes.slice(-lookback);
  const min = Math.min(...subset);
  const max = Math.max(...subset);
  const range = max - min;
  if (range === 0) return 0.5;
  
  const current = subset[subset.length - 1];
  const binSize = range / numBins;
  const currentBin = Math.floor((current - min) / binSize);
  
  const binCounts = new Array(numBins).fill(0);
  for (const price of subset) {
    const bin = Math.min(Math.floor((price - min) / binSize), numBins - 1);
    binCounts[bin]++;
  }
  
  const probability = binCounts[currentBin] / subset.length;
  
  const neighborBins = currentBin > 0 ? binCounts[currentBin - 1] : 0;
  const neighborBinsR = currentBin < numBins - 1 ? binCounts[currentBin + 1] : 0;
  const coherence = (neighborBins + binCounts[currentBin] + neighborBinsR) / subset.length;
  
  return probability * coherence;
}

function computeDiffusionState(returns: number[], lookback: number): number {
  if (returns.length < lookback) return 0;
  
  const subset = returns.slice(-lookback);
  const mean = subset.reduce((a, b) => a + b, 0) / subset.length;
  const variance = subset.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / subset.length;
  const stdDev = Math.sqrt(variance);
  
  const recentReturns = subset.slice(-Math.floor(lookback / 3));
  const recentMean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
  
  const zScore = (recentMean - mean) / (stdDev + 0.0001);
  
  return Math.tanh(zScore * 0.5);
}

function computePricePosition(closes: number[], lookback: number): number {
  if (closes.length < lookback) return 0.5;
  
  const subset = closes.slice(-lookback);
  const current = subset[subset.length - 1];
  const min = Math.min(...subset);
  const max = Math.max(...subset);
  
  if (max === min) return 0.5;
  return (current - min) / (max - min);
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

export interface StratIter65AParams extends StrategyParams {
  quantum_lookback: number;
  quantum_bins: number;
  quantum_prob_threshold: number;
  diffusion_lookback: number;
  diffusion_threshold: number;
  position_lookback: number;
  position_low: number;
  position_high: number;
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

export class StratIter65AStrategy implements Strategy {
  params: StratIter65AParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter65AParams> = {}) {
    const saved = loadSavedParams<StratIter65AParams>('strat_iter65_a.params.json');
    this.params = {
      quantum_lookback: 25,
      quantum_bins: 12,
      quantum_prob_threshold: 0.15,
      diffusion_lookback: 20,
      diffusion_threshold: 0.3,
      position_lookback: 30,
      position_low: 0.25,
      position_high: 0.75,
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
    } as StratIter65AParams;
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
      quantumProbs: [],
      diffusionState: 0,
      pricePositions: [],
      stoch: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeQuantumIndicators(s: TokenState): void {
    const ql = Math.floor(this.params.quantum_lookback);
    const qb = Math.floor(this.params.quantum_bins);
    
    if (s.closes.length >= ql) {
      const prob = computeQuantumProbability(s.closes, ql, qb);
      capPush(s.quantumProbs, prob);
    }
    
    const dl = Math.floor(this.params.diffusion_lookback);
    if (s.returns.length >= dl) {
      s.diffusionState = computeDiffusionState(s.returns, dl);
    }
    
    const pl = Math.floor(this.params.position_lookback);
    if (s.closes.length >= pl) {
      const pos = computePricePosition(s.closes, pl);
      capPush(s.pricePositions, pos);
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

    this.computeQuantumIndicators(s);

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

    if (k === null || !s.stoch || s.stoch.length < 2 || s.quantumProbs.length < 3) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const quantumLow = s.quantumProbs[s.quantumProbs.length - 1] < this.params.quantum_prob_threshold;
    const quantumAvg = s.quantumProbs.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const quantumConverging = quantumAvg < this.params.quantum_prob_threshold * 1.2;

    const diffusionValid = Math.abs(s.diffusionState) < this.params.diffusion_threshold;

    const positionValid = s.pricePositions.length > 0 && 
      s.pricePositions[s.pricePositions.length - 1] > this.params.position_low &&
      s.pricePositions[s.pricePositions.length - 1] < this.params.position_high;

    if (nearSupport && supportReclaim && stochRebound && quantumLow && quantumConverging && diffusionValid && positionValid) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
