import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter72EParams extends StrategyParams {
  embedding_dim: number;
  tau: number;
  max_time: number;
  lyap_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter72EParams = {
  embedding_dim: 3,
  tau: 3,
  max_time: 10,
  lyap_threshold: 0,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter72EParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter72_e.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter72EStrategy implements Strategy {
  params: StratIter72EParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter72EParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter72EParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number = 14): number | null {
    if (closes.length < period || highs.length < period || lows.length < period) return null;
    const windowHigh = Math.max(...highs.slice(-period));
    const windowLow = Math.min(...lows.slice(-period));
    if (windowHigh === windowLow) return 50;
    return ((closes[closes.length - 1] - windowLow) / (windowHigh - windowLow)) * 100;
  }

  private supportFromPriorBars(lows: number[], lookback: number): number | null {
    if (lows.length < lookback + 1) return null;
    return Math.min(...lows.slice(-(lookback + 1), -1));
  }

  private calculateStdDev(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / data.length);
  }

  private buildPhaseSpace(data: number[], m: number, tau: number): number[][] {
    const vectors: number[][] = [];
    const n = data.length - (m - 1) * tau;
    
    for (let i = 0; i < n; i++) {
      const vector: number[] = [];
      for (let j = 0; j < m; j++) {
        vector.push(data[i + j * tau]);
      }
      vectors.push(vector);
    }
    
    return vectors;
  }

  private euclideanDistance(v1: number[], v2: number[]): number {
    let sum = 0;
    for (let i = 0; i < v1.length; i++) {
      sum += Math.pow(v1[i] - v2[i], 2);
    }
    return Math.sqrt(sum);
  }

  private calculateLargestLyapunovExponent(
    data: number[], 
    embeddingDim: number, 
    tau: number, 
    maxTime: number
  ): number | null {
    const minDataLength = (embeddingDim - 1) * tau + maxTime + 10;
    if (data.length < minDataLength) return null;

    const vectors = this.buildPhaseSpace(data, embeddingDim, tau);
    const n = vectors.length;
    
    if (n < 10) return null;

    const divergences: number[][] = [];
    for (let t = 0; t <= maxTime; t++) {
      divergences.push([]);
    }

    const minSeparation = Math.max(embeddingDim, tau);

    for (let i = 0; i < n - maxTime; i++) {
      let minDist = Infinity;
      let nearestIdx = -1;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (Math.abs(i - j) < minSeparation) continue;

        const dist = this.euclideanDistance(vectors[i], vectors[j]);
        if (dist < minDist && dist > 1e-10) {
          minDist = dist;
          nearestIdx = j;
        }
      }

      if (nearestIdx === -1) continue;

      const initialDist = this.euclideanDistance(vectors[i], vectors[nearestIdx]);
      if (initialDist < 1e-10) continue;

      for (let t = 0; t <= maxTime; t++) {
        if (i + t >= n || nearestIdx + t >= n) break;
        
        const dist = this.euclideanDistance(vectors[i + t], vectors[nearestIdx + t]);
        divergences[t].push(Math.log(dist / initialDist));
      }
    }

    const avgDivergences: number[] = [];
    for (let t = 0; t <= maxTime; t++) {
      if (divergences[t].length > 0) {
        const avg = divergences[t].reduce((a, b) => a + b, 0) / divergences[t].length;
        avgDivergences.push(avg);
      }
    }

    if (avgDivergences.length < 3) return null;

    const tValues: number[] = [];
    const logDivergences: number[] = [];
    
    for (let t = 0; t < avgDivergences.length; t++) {
      if (isFinite(avgDivergences[t]) && !isNaN(avgDivergences[t])) {
        tValues.push(t);
        logDivergences.push(avgDivergences[t]);
      }
    }

    if (tValues.length < 2) return null;

    const nPoints = tValues.length;
    const sumT = tValues.reduce((a, b) => a + b, 0);
    const sumY = logDivergences.reduce((a, b) => a + b, 0);
    const sumTY = tValues.reduce((acc, t, i) => acc + t * logDivergences[i], 0);
    const sumT2 = tValues.reduce((acc, t) => acc + t * t, 0);

    const denominator = nPoints * sumT2 - sumT * sumT;
    if (Math.abs(denominator) < 1e-10) return null;

    const lyapunov = (nPoints * sumTY - sumT * sumY) / denominator;

    return lyapunov;
  }

  private clearPositionTracking(tokenId: string): void {
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);

    if (closes.length > 320) closes.shift();
    if (highs.length > 320) highs.shift();
    if (lows.length > 320) lows.shift();

    const k = this.stochasticK(closes, highs, lows, 14);
    const support = this.supportFromPriorBars(lows, this.params.sr_lookback);

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBarNum === undefined) return;

      if (bar.low <= entry * (1 - this.params.stop_loss)) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
        return;
      }

      if (bar.high >= entry * (1 + this.params.profit_target)) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
        return;
      }

      if (barNum - entryBarNum >= this.params.max_hold_bars) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (support === null) return;
    if (k === null) return;

    const supportDistance = (bar.close - support) / support;
    if (supportDistance > 0.05) return;

    if (k >= this.params.stoch_oversold) return;

    const lyapunov = this.calculateLargestLyapunovExponent(
      closes,
      this.params.embedding_dim,
      this.params.tau,
      this.params.max_time
    );

    if (lyapunov === null) return;
    if (lyapunov >= this.params.lyap_threshold) return;

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

  onComplete(_ctx: BacktestContext): void {}
}
