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

export interface StratIter75CParams extends StrategyParams {
  window_size: number;
  n_clusters: number;
  history_size: number;
  distance_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

function computeReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  return returns;
}

function normalizePattern(pattern: number[]): number[] | null {
  const mean = pattern.reduce((a, b) => a + b, 0) / pattern.length;
  const variance = pattern.reduce((a, b) => a + (b - mean) ** 2, 0) / pattern.length;
  const std = Math.sqrt(variance);
  if (std < 1e-8) return null;
  return pattern.map(v => (v - mean) / std);
}

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function kMeansClustering(patterns: number[][], nClusters: number, maxIter = 10): number[][] {
  if (patterns.length === 0 || nClusters <= 0) return [];
  const dim = patterns[0].length;
  const actualClusters = Math.min(nClusters, patterns.length);
  
  const centers: number[][] = [];
  const indices = new Set<number>();
  while (indices.size < actualClusters) {
    indices.add(Math.floor(Math.random() * patterns.length));
  }
  Array.from(indices).forEach(i => {
    centers.push([...patterns[i]]);
  });
  
  for (let iter = 0; iter < maxIter; iter++) {
    const assignments: number[][] = Array.from({ length: actualClusters }, () => []);
    
    for (let p = 0; p < patterns.length; p++) {
      let minDist = Infinity;
      let minIdx = 0;
      for (let c = 0; c < centers.length; c++) {
        const dist = euclideanDistance(patterns[p], centers[c]);
        if (dist < minDist) {
          minDist = dist;
          minIdx = c;
        }
      }
      assignments[minIdx].push(p);
    }
    
    for (let c = 0; c < actualClusters; c++) {
      if (assignments[c].length > 0) {
        const newCenter = new Array(dim).fill(0);
        for (const p of assignments[c]) {
          for (let d = 0; d < dim; d++) {
            newCenter[d] += patterns[p][d];
          }
        }
        for (let d = 0; d < dim; d++) {
          newCenter[d] /= assignments[c].length;
        }
        centers[c] = newCenter;
      }
    }
  }
  
  return centers;
}

function findNearestClusterDistance(pattern: number[], centers: number[][]): number {
  if (centers.length === 0) return Infinity;
  let minDist = Infinity;
  for (const center of centers) {
    const dist = euclideanDistance(pattern, center);
    if (dist < minDist) {
      minDist = dist;
    }
  }
  return minDist;
}

export class StratIter75CStrategy extends BaseIterStrategy<StratIter75CParams> {
  private kVals: Map<string, number[]> = new Map();
  private clusterCenters: Map<string, number[][]> = new Map();
  private patternBuffer: Map<string, number[][]> = new Map();
  private lastClusterUpdate: Map<string, number> = new Map();

  constructor(params: Partial<StratIter75CParams> = {}) {
    super('strat_iter75_c.params.json', {
      window_size: 15,
      n_clusters: 10,
      history_size: 75,
      distance_threshold: 1.0,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  private updateClusters(tokenId: string, returns: number[], windowSize: number, historySize: number, nClusters: number): void {
    if (returns.length < windowSize + 1) return;
    
    const patterns: number[][] = [];
    for (let i = Math.max(0, returns.length - historySize - windowSize); i <= returns.length - windowSize; i++) {
      const window = returns.slice(i, i + windowSize);
      const normalized = normalizePattern(window);
      if (normalized) {
        patterns.push(normalized);
      }
    }
    
    if (patterns.length >= nClusters) {
      this.patternBuffer.set(tokenId, patterns);
      this.clusterCenters.set(tokenId, kMeansClustering(patterns, nClusters, 10));
    }
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) {
      this.kVals.set(bar.tokenId, []);
      this.patternBuffer.set(bar.tokenId, []);
      this.clusterCenters.set(bar.tokenId, []);
      this.lastClusterUpdate.set(bar.tokenId, 0);
    }
    
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

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

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2) return;

    const returns = computeReturns(series.closes);
    const lastUpdate = this.lastClusterUpdate.get(bar.tokenId) || 0;
    
    if (barNum - lastUpdate >= 10 && returns.length >= this.params.window_size + 10) {
      this.updateClusters(
        bar.tokenId, 
        returns, 
        this.params.window_size, 
        this.params.history_size, 
        this.params.n_clusters
      );
      this.lastClusterUpdate.set(bar.tokenId, barNum);
    }

    const centers = this.clusterCenters.get(bar.tokenId)!;
    if (centers.length === 0 || returns.length < this.params.window_size) return;

    const currentWindow = returns.slice(-this.params.window_size);
    const currentPattern = normalizePattern(currentWindow);
    if (!currentPattern) return;

    const distance = findNearestClusterDistance(currentPattern, centers);
    
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = kv[kv.length - 1] < this.params.stoch_oversold;
    const lowDistance = distance < this.params.distance_threshold;

    if (nearSupport && stochOversold && lowDistance) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
