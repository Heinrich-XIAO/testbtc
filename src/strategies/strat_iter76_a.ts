import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
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

function capPush(values: number[], value: number, max = 500): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return 50;
  return ((closes[closes.length - 1] - l) / (h - l)) * 100;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function computeNormalizedReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  return returns;
}

function computeMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function computeStd(arr: number[], mean: number): number {
  if (arr.length === 0) return 0;
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function normalize(arr: number[]): { normalized: number[]; mean: number; std: number } {
  const mean = computeMean(arr);
  const std = computeStd(arr, mean);
  if (std === 0) {
    return { normalized: arr.map(() => 0), mean, std };
  }
  return {
    normalized: arr.map(v => (v - mean) / std),
    mean,
    std
  };
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

function getKDistanceNeighbors(points: number[][], pointIndex: number, k: number): { distances: number[]; indices: number[] } {
  const distances: { dist: number; idx: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i !== pointIndex) {
      distances.push({ dist: euclideanDistance(points[pointIndex], points[i]), idx: i });
    }
  }
  distances.sort((a, b) => a.dist - b.dist);
  const kNearest = distances.slice(0, k);
  return {
    distances: kNearest.map(d => d.dist),
    indices: kNearest.map(d => d.idx)
  };
}

function computeReachabilityDistance(points: number[][], pointA: number, pointB: number, kDistanceB: number): number {
  const dist = euclideanDistance(points[pointA], points[pointB]);
  return Math.max(kDistanceB, dist);
}

function computeLocalReachabilityDensity(
  points: number[][],
  pointIndex: number,
  neighbors: number[],
  kDistances: number[]
): number {
  if (neighbors.length === 0) return 0;
  
  let sumReachability = 0;
  for (const neighborIdx of neighbors) {
    const reachDist = computeReachabilityDistance(
      points,
      pointIndex,
      neighborIdx,
      kDistances[neighborIdx]
    );
    sumReachability += reachDist;
  }
  
  if (sumReachability === 0) return Infinity;
  return neighbors.length / sumReachability;
}

function computeLOF(
  points: number[][],
  pointIndex: number,
  k: number
): number | null {
  if (points.length < k + 1) return null;
  
  const neighbors = getKDistanceNeighbors(points, pointIndex, k);
  if (neighbors.indices.length === 0) return null;
  
  const kDistances: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const neighborInfo = getKDistanceNeighbors(points, i, k);
    kDistances[i] = neighborInfo.distances.length > 0 ? neighborInfo.distances[neighborInfo.distances.length - 1] : 0;
  }
  
  const lrdPoint = computeLocalReachabilityDensity(points, pointIndex, neighbors.indices, kDistances);
  
  if (lrdPoint === 0 || lrdPoint === Infinity) return null;
  
  let sumLRDRatio = 0;
  for (const neighborIdx of neighbors.indices) {
    const neighborNeighbors = getKDistanceNeighbors(points, neighborIdx, k);
    const lrdNeighbor = computeLocalReachabilityDensity(points, neighborIdx, neighborNeighbors.indices, kDistances);
    
    if (lrdNeighbor === 0 || lrdNeighbor === Infinity) return null;
    sumLRDRatio += lrdNeighbor / lrdPoint;
  }
  
  return sumLRDRatio / neighbors.indices.length;
}

function computeLOFSignal(
  closes: number[],
  windowSize: number,
  kNeighbors: number
): number | null {
  if (closes.length < windowSize * 3) return null;
  
  const returns = computeNormalizedReturns(closes);
  if (returns.length < windowSize * 3) return null;
  
  const windows: number[][] = [];
  for (let i = 0; i <= returns.length - windowSize; i++) {
    const window = returns.slice(i, i + windowSize);
    const { normalized } = normalize(window);
    windows.push(normalized);
  }
  
  if (windows.length < kNeighbors + 2) return null;
  
  const currentWindow = windows[windows.length - 1];
  const historicalWindows = windows.slice(0, -1);
  
  const allPoints = [...historicalWindows, currentWindow];
  const currentIdx = allPoints.length - 1;
  
  const lof = computeLOF(allPoints, currentIdx, kNeighbors);
  return lof;
}

abstract class BaseIterStrategy<P extends StrategyParams> implements Strategy {
  params: P;
  protected series: Map<string, TokenSeries> = new Map();
  protected bars: Map<string, number> = new Map();
  protected entryPrice: Map<string, number> = new Map();
  protected entryBar: Map<string, number> = new Map();

  constructor(fileName: string, defaults: P, params: Partial<P>) {
    const saved = loadSavedParams<P>(fileName);
    this.params = { ...defaults, ...saved, ...params } as P;
  }

  onInit(_ctx: BacktestContext): void {}

  protected nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  protected open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
    const cash = ctx.getCapital() * riskPercent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (result.success) {
      this.entryPrice.set(bar.tokenId, bar.close);
      this.entryBar.set(bar.tokenId, barNum);
      return true;
    }
    return false;
  }

  protected close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter76AParams extends StrategyParams {
  window_size: number;
  k_neighbors: number;
  lof_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter76AStrategy extends BaseIterStrategy<StratIter76AParams> {
  constructor(params: Partial<StratIter76AParams> = {}) {
    super('strat_iter76_a.params.json', {
      window_size: 15,
      k_neighbors: 10,
      lof_threshold: 1.2,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const lof = computeLOFSignal(
      series.closes,
      this.params.window_size,
      this.params.k_neighbors
    );

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          (sr && bar.high >= sr.resistance * 0.98) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || lof === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const normalPattern = lof < this.params.lof_threshold;

    if (nearSupport && stochOversold && normalPattern) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
