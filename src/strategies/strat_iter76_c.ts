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

export interface StratIter76CParams extends StrategyParams {
  feature_window: number;
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

function computeMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function computeStd(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = computeMean(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function computeFeatureVector(returns: number[], window: number): number[] | null {
  if (returns.length < window) return null;
  
  const recentReturns = returns.slice(-window);
  
  const avgReturn = computeMean(recentReturns);
  const volatility = computeStd(recentReturns);
  
  let momentum = 0;
  if (returns.length >= window * 2) {
    const olderReturns = returns.slice(-window * 2, -window);
    const olderAvg = computeMean(olderReturns);
    momentum = avgReturn - olderAvg;
  }
  
  return [avgReturn, volatility, momentum];
}

function computeMeanVector(data: number[][]): number[] {
  if (data.length === 0) return [];
  const dim = data[0].length;
  const mean: number[] = new Array(dim).fill(0);
  for (const row of data) {
    for (let i = 0; i < dim; i++) {
      mean[i] += row[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    mean[i] /= data.length;
  }
  return mean;
}

function computeCovarianceMatrix(data: number[][], mean: number[]): number[][] {
  if (data.length === 0) return [];
  const n = data.length;
  const dim = data[0].length;
  const cov: number[][] = [];
  
  for (let i = 0; i < dim; i++) {
    cov[i] = [];
    for (let j = 0; j < dim; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += (data[k][i] - mean[i]) * (data[k][j] - mean[j]);
      }
      cov[i][j] = sum / n;
    }
  }
  
  return cov;
}

function addRegularization(cov: number[][], lambda: number): number[][] {
  const dim = cov.length;
  const regularized: number[][] = [];
  for (let i = 0; i < dim; i++) {
    regularized[i] = [...cov[i]];
    regularized[i][i] += lambda;
  }
  return regularized;
}

function invertMatrix(matrix: number[][]): number[][] | null {
  const n = matrix.length;
  if (n === 0) return null;
  
  const augmented: number[][] = [];
  for (let i = 0; i < n; i++) {
    augmented[i] = [...matrix[i], ...new Array(n).fill(0)];
    augmented[i][n + i] = 1;
  }
  
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }
    
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
    
    if (Math.abs(augmented[col][col]) < 1e-10) {
      return null;
    }
    
    const pivot = augmented[col][col];
    for (let j = 0; j < 2 * n; j++) {
      augmented[col][j] /= pivot;
    }
    
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = augmented[row][col];
        for (let j = 0; j < 2 * n; j++) {
          augmented[row][j] -= factor * augmented[col][j];
        }
      }
    }
  }
  
  const inverse: number[][] = [];
  for (let i = 0; i < n; i++) {
    inverse[i] = augmented[i].slice(n);
  }
  
  return inverse;
}

function transpose(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result: number[][] = [];
  for (let j = 0; j < cols; j++) {
    result[j] = [];
    for (let i = 0; i < rows; i++) {
      result[j][i] = matrix[i][j];
    }
  }
  return result;
}

function matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
  if (matrix.length === 0) return [];
  const result: number[] = [];
  for (let i = 0; i < matrix.length; i++) {
    let sum = 0;
    for (let j = 0; j < vector.length; j++) {
      sum += matrix[i][j] * vector[j];
    }
    result.push(sum);
  }
  return result;
}

function vectorDot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function computeMahalanobisDistance(x: number[], mean: number[], covInverse: number[][]): number {
  const diff = x.map((val, i) => val - mean[i]);
  const covTimesDiff = matrixVectorMultiply(covInverse, diff);
  const distSquared = vectorDot(diff, covTimesDiff);
  return Math.sqrt(Math.max(0, distSquared));
}

export class StratIter76CStrategy extends BaseIterStrategy<StratIter76CParams> {
  private featureHistory: Map<string, number[][]> = new Map();
  private lastUpdate: Map<string, number> = new Map();

  constructor(params: Partial<StratIter76CParams> = {}) {
    super('strat_iter76_c.params.json', {
      feature_window: 10,
      history_size: 75,
      distance_threshold: 3.0,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.featureHistory.has(bar.tokenId)) {
      this.featureHistory.set(bar.tokenId, []);
      this.lastUpdate.set(bar.tokenId, 0);
    }

    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
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

    if (shouldSkipPrice(bar.close) || !sr || k === null) return;

    const returns = computeReturns(series.closes);
    const feature = computeFeatureVector(returns, this.params.feature_window);
    if (!feature) return;

    const history = this.featureHistory.get(bar.tokenId)!;
    history.push(feature);
    if (history.length > this.params.history_size) {
      history.shift();
    }

    if (history.length < 10) return;

    const mean = computeMeanVector(history);
    let cov = computeCovarianceMatrix(history, mean);
    cov = addRegularization(cov, 0.001);
    const covInverse = invertMatrix(cov);
    
    if (!covInverse) return;

    const distance = computeMahalanobisDistance(feature, mean, covInverse);

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k < this.params.stoch_oversold;
    const normalPattern = distance < this.params.distance_threshold;

    if (nearSupport && stochOversold && normalPattern) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
