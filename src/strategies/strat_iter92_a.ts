import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter92AParams extends StrategyParams {
  knn_k: number;
  knn_lookback: number;
  prediction_threshold: number;
  feature_window: number;
  stoch_oversold: number;
  stoch_k_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter92AParams = {
  knn_k: 5,
  knn_lookback: 50,
  prediction_threshold: 0.015,
  feature_window: 10,
  stoch_oversold: 16,
  stoch_k_period: 14,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter92AParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter92_a.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

function extractFeatures(closes: number[], window: number): number[] {
  if (closes.length < window) return [];
  const recent = closes.slice(-window);
  const mean = recent.reduce((a, b) => a + b, 0) / window;
  const std = Math.sqrt(recent.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window);
  const normalized = recent.map(v => std > 0.0001 ? (v - mean) / std : 0);
  return normalized;
}

function knnPredictReturn(closes: number[], k: number, lookback: number, featureWindow: number): number | null {
  if (closes.length < lookback + featureWindow + 1) return null;
  
  const currentFeatures = extractFeatures(closes, featureWindow);
  if (currentFeatures.length === 0) return null;
  
  const distances: { distance: number; futureReturn: number }[] = [];
  
  for (let i = featureWindow; i < lookback; i++) {
    const pastFeatures = extractFeatures(closes.slice(0, closes.length - lookback + i), featureWindow);
    if (pastFeatures.length === 0) continue;
    
    const dist = euclideanDistance(currentFeatures, pastFeatures);
    const idx = closes.length - lookback + i;
    if (idx + 1 < closes.length) {
      const futureReturn = (closes[idx + 1] - closes[idx]) / closes[idx];
      distances.push({ distance: dist, futureReturn });
    }
  }
  
  if (distances.length < k) return null;
  
  distances.sort((a, b) => a.distance - b.distance);
  const nearest = distances.slice(0, k);
  const totalDist = nearest.reduce((sum, d) => sum + d.distance + 0.0001, 0);
  
  let weightedReturn = 0;
  for (const n of nearest) {
    const weight = (n.distance + 0.0001) / totalDist;
    weightedReturn += n.futureReturn * (1 - weight) / (k - 1);
  }
  
  return weightedReturn;
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

export class StratIter92AStrategy implements Strategy {
  params: StratIter92AParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private predictions: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter92AParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter92AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.predictions.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const predictions = this.predictions.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    capPush(closes, bar.close);
    capPush(highs, bar.high);
    capPush(lows, bar.low);

    const predictedReturn = knnPredictReturn(closes, this.params.knn_k, this.params.knn_lookback, this.params.feature_window);
    if (predictedReturn !== null) {
      capPush(predictions, predictedReturn);
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
    if (kVals.length < 3 || predictions.length < 2) return;

    const currK = kVals[kVals.length - 1];
    const prevK = kVals[kVals.length - 2];
    const kRising = currK > prevK + 1;
    const oversold = currK <= this.params.stoch_oversold;

    const currPred = predictions[predictions.length - 1];
    const prevPred = predictions[predictions.length - 2];
    const predTurningUp = currPred > prevPred && currPred > this.params.prediction_threshold;

    const nearSupport = bar.close <= sr.support * 1.02;

    if (kRising && oversold && predTurningUp && nearSupport) {
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
