import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter69CParams extends StrategyParams {
  num_capsules: number;
  routing_iterations: number;
  consensus_threshold: number;
  capsule_dim: number;
  stoch_oversold: number;
  stoch_k_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter69CParams = {
  num_capsules: 4,
  routing_iterations: 3,
  consensus_threshold: 0.65,
  capsule_dim: 4,
  stoch_oversold: 16,
  stoch_k_period: 14,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter69CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter69_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

interface Capsule {
  vector: number[];
  activation: number;
}

function squash(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm < 0.0001) return vector.map(() => 0);
  const scale = (norm * norm) / (1 + norm * norm) / norm;
  return vector.map(v => v * scale);
}

function initCapsuleFeatures(closes: number[], highs: number[], lows: number[], numCapsules: number): Capsule[] {
  const capsules: Capsule[] = [];
  const windowSize = Math.floor(closes.length / numCapsules);
  
  for (let i = 0; i < numCapsules; i++) {
    const start = Math.max(0, closes.length - (numCapsules - i) * windowSize);
    const end = Math.min(closes.length, start + windowSize);
    
    if (end - start < 3) {
      capsules.push({ vector: [0, 0, 0, 0], activation: 0 });
      continue;
    }
    
    const slice = closes.slice(start, end);
    const highSlice = highs.slice(start, end);
    const lowSlice = lows.slice(start, end);
    
    const momentum = (slice[slice.length - 1] - slice[0]) / slice[0];
    const volatility = Math.sqrt(slice.reduce((sum, v) => sum + Math.pow(v - slice[0], 2), 0) / slice.length) / slice[0];
    const range = (Math.max(...highSlice) - Math.min(...lowSlice)) / slice[0];
    const trend = slice.length > 1 ? (slice[slice.length - 1] > slice[0] ? 1 : -1) : 0;
    
    capsules.push({
      vector: [momentum * 10, volatility * 5, range * 3, trend],
      activation: Math.sqrt(momentum * momentum + volatility * volatility),
    });
  }
  return capsules;
}

function dynamicRouting(capsules: Capsule[], iterations: number): number {
  if (capsules.length === 0) return 0;
  
  let b: number[][] = capsules.map(() => capsules.map(() => 0));
  
  for (let iter = 0; iter < iterations; iter++) {
    const c: number[][] = b.map(row => row.map((val, j) => {
      const sum = row.reduce((a, b) => a + Math.exp(b), 0);
      return Math.exp(val) / sum;
    }));
    
    const s: number[] = capsules.map((_, i) => {
      let sum = 0;
      for (let j = 0; j < capsules.length; j++) {
        sum += c[j][i] * capsules[j].activation;
      }
      return sum;
    });
    
    const v = s.map(val => squash([val, val * 0.5, val * 0.3, val * 0.2]));
    
    for (let i = 0; i < capsules.length; i++) {
      for (let j = 0; j < capsules.length; j++) {
        b[i][j] += v[j][0] * capsules[i].activation;
      }
    }
  }
  
  const finalC = b.map(row => {
    const sum = row.reduce((a, b) => a + Math.exp(b), 0);
    return row.map(val => Math.exp(val) / sum);
  });
  
  let consensus = 0;
  for (let i = 0; i < capsules.length; i++) {
    consensus += finalC[i][i] * capsules[i].activation;
  }
  return consensus / capsules.length;
}

function stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period) return null;
  const highSlice = highs.slice(-period);
  const lowSlice = lows.slice(-period);
  const highest = Math.max(...highSlice);
  const lowest = Math.min(...lowSlice);
  if (highest === lowest) return 50;
  return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
}

function supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function capPush<T>(arr: T[], val: T, max = 500): void {
  arr.push(val);
  if (arr.length > max) arr.shift();
}

export class StratIter69CStrategy implements Strategy {
  params: StratIter69CParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private consensusScores: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter69CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter69CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.consensusScores.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const consensusScores = this.consensusScores.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    capPush(closes, bar.close);
    capPush(highs, bar.high);
    capPush(lows, bar.low);

    if (closes.length > this.params.num_capsules * 3) {
      const capsules = initCapsuleFeatures(closes, highs, lows, this.params.num_capsules);
      const consensus = dynamicRouting(capsules, this.params.routing_iterations);
      capPush(consensusScores, consensus);
    }

    const k = stochasticK(closes, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      capPush(kVals, k);
    }

    const sr = supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.low <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
        if (bar.high >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (kVals.length < 3 || consensusScores.length < 1) return;

    const currK = kVals[kVals.length - 1];
    const prevK = kVals[kVals.length - 2];
    const kRising = currK > prevK + 1;
    const oversold = currK <= this.params.stoch_oversold;

    const consensus = consensusScores[consensusScores.length - 1];
    const consensusReached = consensus > this.params.consensus_threshold;

    const nearSupport = bar.close <= sr.support * 1.02;

    if (kRising && oversold && consensusReached && nearSupport) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
