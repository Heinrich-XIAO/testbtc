import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter69AParams extends StrategyParams {
  embedding_dim: number;
  tau: number;
  fnn_threshold: number;
  stoch_oversold: number;
  stoch_k_period: number;
  min_dimension: number;
  reconstruction_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter69AParams = {
  embedding_dim: 4,
  tau: 3,
  fnn_threshold: 0.15,
  stoch_oversold: 16,
  stoch_k_period: 14,
  min_dimension: 2,
  reconstruction_threshold: 0.08,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter69AParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter69_a.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function phaseSpaceReconstruction(closes: number[], tau: number, dim: number): number[][] {
  const n = closes.length - (dim - 1) * tau;
  if (n <= 0) return [];
  const phaseSpace: number[][] = [];
  for (let i = 0; i < n; i++) {
    const point: number[] = [];
    for (let d = 0; d < dim; d++) {
      point.push(closes[i + d * tau]);
    }
    phaseSpace.push(point);
  }
  return phaseSpace;
}

function falseNearestNeighbors(closes: number[], maxDim: number, tau: number): number[] {
  const fnnPercentages: number[] = [];
  for (let dim = 1; dim <= maxDim; dim++) {
    const ps1 = phaseSpaceReconstruction(closes, tau, dim);
    const ps2 = phaseSpaceReconstruction(closes, tau, dim + 1);
    if (ps1.length < 10 || ps2.length < 10) {
      fnnPercentages.push(1);
      continue;
    }
    let fnnCount = 0;
    const sampleSize = Math.min(50, ps1.length);
    for (let i = 0; i < sampleSize; i++) {
      let minDist = Infinity;
      for (let j = 0; j < ps1.length; j++) {
        if (i === j) continue;
        let dist = 0;
        for (let d = 0; d < dim; d++) {
          dist += Math.pow(ps1[i][d] - ps1[j][d], 2);
        }
        dist = Math.sqrt(dist);
        if (dist < minDist) minDist = dist;
      }
      if (minDist < 0.001) {
        fnnCount++;
        continue;
      }
      const R = Math.abs(ps2[i][dim] - ps1[i][0]) / minDist;
      if (R > 0.15) fnnCount++;
    }
    fnnPercentages.push(fnnCount / sampleSize);
  }
  return fnnPercentages;
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

export class StratIter69AStrategy implements Strategy {
  params: StratIter69AParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private detectedDim: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter69AParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter69AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    capPush(closes, bar.close);
    capPush(highs, bar.high);
    capPush(lows, bar.low);

    if (closes.length > 150) {
      const fnn = falseNearestNeighbors(closes.slice(-100), this.params.embedding_dim, this.params.tau);
      let bestDim = this.params.min_dimension;
      let minFnn = fnn[0] || 1;
      for (let i = 1; i < fnn.length; i++) {
        if (fnn[i] < minFnn) {
          minFnn = fnn[i];
          bestDim = i + 1;
        }
      }
      if (minFnn < this.params.fnn_threshold) {
        this.detectedDim.set(bar.tokenId, bestDim);
      }
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
    if (kVals.length < 3) return;

    const detectedDim = this.detectedDim.get(bar.tokenId) || this.params.embedding_dim;
    const ps = phaseSpaceReconstruction(closes.slice(-(detectedDim * this.params.tau + 10)), this.params.tau, detectedDim);
    let stable = false;
    if (ps.length > 5) {
      const recent = ps.slice(-3);
      const std = Math.sqrt(recent.reduce((sum, p) => sum + Math.pow(p[0] - recent[0][0], 2), 0) / recent.length);
      stable = std < this.params.reconstruction_threshold * bar.close;
    }

    const currK = kVals[kVals.length - 1];
    const prevK = kVals[kVals.length - 2];
    const kRising = currK > prevK + 1;
    const nearSupport = bar.close <= sr.support * (1 + this.params.reconstruction_threshold);
    const oversold = currK <= this.params.stoch_oversold;

    if (stable && kRising && nearSupport && oversold) {
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
