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

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function scaleVector(v: number[], scalar: number): number[] {
  return v.map(x => x * scalar);
}

function addVectors(a: number[], b: number[]): number[] {
  return a.map((x, i) => x + (b[i] || 0));
}

function subtractVectors(a: number[], b: number[]): number[] {
  return a.map((x, i) => x - (b[i] || 0));
}

function l2Norm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
}

function powerIteration(matrix: number[][], iterations: number = 100): number[] {
  const n = matrix.length;
  if (n === 0) return [];
  
  let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
  const vNorm = l2Norm(v);
  if (vNorm > 0) v = scaleVector(v, 1 / vNorm);
  
  for (let iter = 0; iter < iterations; iter++) {
    const newV: number[] = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += matrix[i][j] * v[j];
      }
      newV.push(sum);
    }
    const newNorm = l2Norm(newV);
    if (newNorm === 0) break;
    v = scaleVector(newV, 1 / newNorm);
  }
  
  return v;
}

function computeCovarianceMatrix(data: number[][]): number[][] {
  const n = data.length;
  const d = data[0]?.length || 0;
  if (n === 0 || d === 0) return [];
  
  const means: number[] = [];
  for (let j = 0; j < d; j++) {
    means[j] = computeMean(data.map(row => row[j]));
  }
  
  const cov: number[][] = [];
  for (let i = 0; i < d; i++) {
    cov[i] = [];
    for (let j = 0; j < d; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += (data[k][i] - means[i]) * (data[k][j] - means[j]);
      }
      cov[i][j] = sum / n;
    }
  }
  
  return cov;
}

function extractPrincipalComponents(data: number[][], numComponents: number): number[][] {
  if (data.length === 0) return [];
  const cov = computeCovarianceMatrix(data);
  const components: number[][] = [];
  
  let remainingMatrix = cov.map(row => [...row]);
  
  for (let c = 0; c < numComponents; c++) {
    const pc = powerIteration(remainingMatrix, 50);
    if (pc.length === 0 || l2Norm(pc) === 0) break;
    
    const normalizedPc = scaleVector(pc, 1 / l2Norm(pc));
    components.push(normalizedPc);
    
    for (let i = 0; i < remainingMatrix.length; i++) {
      for (let j = 0; j < remainingMatrix[i].length; j++) {
        remainingMatrix[i][j] -= normalizedPc[i] * normalizedPc[j] * remainingMatrix[i][j];
      }
    }
  }
  
  return components;
}

function encode(data: number[], components: number[][]): number[] {
  return components.map(pc => dotProduct(data, pc));
}

function decode(latent: number[], components: number[][]): number[] {
  let reconstructed = new Array(components[0]?.length || 0).fill(0);
  for (let i = 0; i < latent.length; i++) {
    if (components[i]) {
      reconstructed = addVectors(reconstructed, scaleVector(components[i], latent[i]));
    }
  }
  return reconstructed;
}

function computeReconstructionError(
  closes: number[],
  windowSize: number,
  latentDim: number
): number | null {
  if (closes.length < windowSize * 2) return null;
  
  const returns = computeNormalizedReturns(closes);
  if (returns.length < windowSize * 2) return null;
  
  const windows: number[][] = [];
  for (let i = 0; i <= returns.length - windowSize; i++) {
    const window = returns.slice(i, i + windowSize);
    const { normalized } = normalize(window);
    windows.push(normalized);
  }
  
  if (windows.length < 5) return null;
  
  const trainingWindows = windows.slice(0, -1);
  const testWindow = windows[windows.length - 1];
  
  const components = extractPrincipalComponents(trainingWindows, latentDim);
  if (components.length === 0) return null;
  
  const latent = encode(testWindow, components);
  const reconstructed = decode(latent, components);
  
  const diff = subtractVectors(testWindow, reconstructed);
  const error = l2Norm(diff) / Math.sqrt(testWindow.length);
  
  return error;
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

export interface StratIter75AParams extends StrategyParams {
  window_size: number;
  latent_dim: number;
  error_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter75AStrategy extends BaseIterStrategy<StratIter75AParams> {
  constructor(params: Partial<StratIter75AParams> = {}) {
    super('strat_iter75_a.params.json', {
      window_size: 15,
      latent_dim: 3,
      error_threshold: 0.2,
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

    const reconError = computeReconstructionError(
      series.closes,
      this.params.window_size,
      this.params.latent_dim
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

    if (shouldSkipPrice(bar.close) || !sr || reconError === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const normalPattern = reconError < this.params.error_threshold;

    if (nearSupport && stochOversold && normalPattern) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
