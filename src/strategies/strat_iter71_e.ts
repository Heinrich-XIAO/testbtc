import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter71EParams extends StrategyParams {
  embedding_dim: number;
  tolerance: number;
  window_size: number;
  rr_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter71EParams = {
  embedding_dim: 3,
  tolerance: 0.2,
  window_size: 40,
  rr_threshold: 0.1,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter71EParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter71_e.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter71EStrategy implements Strategy {
  params: StratIter71EParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter71EParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter71EParams;
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

  private buildEmbeddingVector(data: number[], index: number, dim: number): number[] | null {
    if (index < dim - 1) return null;
    const vector: number[] = [];
    for (let i = 0; i < dim; i++) {
      vector.push(data[index - i]);
    }
    return vector;
  }

  private euclideanDistance(v1: number[], v2: number[]): number {
    let sum = 0;
    for (let i = 0; i < v1.length; i++) {
      sum += Math.pow(v1[i] - v2[i], 2);
    }
    return Math.sqrt(sum);
  }

  private calculateRecurrenceRate(data: number[], windowSize: number, embeddingDim: number, tolerance: number): { rr: number; determinism: number } | null {
    if (data.length < windowSize) return null;
    
    const windowData = data.slice(-windowSize);
    const stdDev = this.calculateStdDev(windowData);
    const epsilon = tolerance * stdDev;
    
    if (epsilon <= 0) return null;
    
    const vectors: number[][] = [];
    for (let i = embeddingDim - 1; i < windowSize; i++) {
      const vec = this.buildEmbeddingVector(windowData, i, embeddingDim);
      if (vec) vectors.push(vec);
    }
    
    const n = vectors.length;
    if (n < 2) return null;
    
    const N = n * n;
    let recurrenceCount = 0;
    const recurrenceMatrix: boolean[][] = [];
    
    for (let i = 0; i < n; i++) {
      recurrenceMatrix[i] = [];
      for (let j = 0; j < n; j++) {
        const dist = this.euclideanDistance(vectors[i], vectors[j]);
        const isRecurrent = dist < epsilon;
        recurrenceMatrix[i][j] = isRecurrent;
        if (isRecurrent) recurrenceCount++;
      }
    }
    
    const rr = recurrenceCount / N;
    
    let diagonalLinePoints = 0;
    let totalRecurrentPoints = 0;
    
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1; j++) {
        if (recurrenceMatrix[i][j]) {
          totalRecurrentPoints++;
          if (recurrenceMatrix[i + 1][j + 1]) {
            diagonalLinePoints++;
          }
        }
      }
    }
    
    const determinism = totalRecurrentPoints > 0 ? diagonalLinePoints / totalRecurrentPoints : 0;
    
    return { rr, determinism };
  }

  private calculateStdDev(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const squaredDiffs = data.map(x => Math.pow(x - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / data.length);
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

    const rqaResult = this.calculateRecurrenceRate(
      closes,
      this.params.window_size,
      this.params.embedding_dim,
      this.params.tolerance
    );

    if (rqaResult === null) return;
    if (rqaResult.rr < this.params.rr_threshold) return;

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
