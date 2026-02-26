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

function createTrajectoryMatrix(data: number[], windowLength: number): number[][] {
  const n = data.length;
  const k = n - windowLength + 1;
  
  if (k <= 0) return [];
  
  const matrix: number[][] = [];
  for (let i = 0; i < windowLength; i++) {
    matrix.push([]);
    for (let j = 0; j < k; j++) {
      matrix[i].push(data[i + j]);
    }
  }
  
  return matrix;
}

function transpose(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];
  const rows = matrix.length;
  const cols = matrix[0].length;
  const result: number[][] = [];
  
  for (let j = 0; j < cols; j++) {
    result.push([]);
    for (let i = 0; i < rows; i++) {
      result[j].push(matrix[i][j]);
    }
  }
  
  return result;
}

function multiplyMatrices(a: number[][], b: number[][]): number[][] {
  if (a.length === 0 || b.length === 0) return [];
  const m = a.length;
  const n = b[0].length;
  const p = b.length;
  const result: number[][] = [];
  
  for (let i = 0; i < m; i++) {
    result.push([]);
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < p; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i].push(sum);
    }
  }
  
  return result;
}

function eigenDecomposition(matrix: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = matrix.length;
  if (n === 0) return { eigenvalues: [], eigenvectors: [] };
  
  const eigenvalues: number[] = [];
  const eigenvectors: number[][] = [];
  
  let currentMatrix = matrix.map(row => [...row]);
  
  for (let iter = 0; iter < n; iter++) {
    let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    v = v.map(x => x / norm);
    
    let eigenvalue = 0;
    for (let i = 0; i < 50; i++) {
      const Av = currentMatrix.map(row => row.reduce((sum, x, idx) => sum + x * v[idx], 0));
      const newNorm = Math.sqrt(Av.reduce((sum, x) => sum + x * x, 0));
      if (newNorm < 1e-10) break;
      v = Av.map(x => x / newNorm);
      eigenvalue = newNorm;
    }
    
    eigenvalues.push(eigenvalue);
    eigenvectors.push([...v]);
    
    const outerProduct = v.map((vi, i) => v.map((vj, j) => vi * vj * eigenvalue));
    currentMatrix = currentMatrix.map((row, i) => row.map((val, j) => val - outerProduct[i][j]));
  }
  
  const sorted = eigenvalues.map((ev, i) => ({ ev, idx: i })).sort((a, b) => b.ev - a.ev);
  return {
    eigenvalues: sorted.map(s => s.ev),
    eigenvectors: sorted.map(s => eigenvectors[s.idx])
  };
}

function ssaDecompose(data: number[], windowLength: number, numComponents: number): { trend: number[]; residual: number[] } {
  const n = data.length;
  if (n < windowLength * 2) return { trend: data, residual: new Array(n).fill(0) };
  
  const X = createTrajectoryMatrix(data, windowLength);
  if (X.length === 0) return { trend: data, residual: new Array(n).fill(0) };
  
  const Xt = transpose(X);
  const XtX = multiplyMatrices(Xt, X);
  
  const { eigenvalues, eigenvectors } = eigenDecomposition(XtX);
  
  const components = Math.min(numComponents, eigenvalues.length);
  
  const trendTrajectory: number[][] = X.map(row => [...row]);
  for (let i = 0; i < trendTrajectory.length; i++) {
    for (let j = 0; j < trendTrajectory[i].length; j++) {
      trendTrajectory[i][j] = 0;
    }
  }
  
  for (let c = 0; c < components; c++) {
    const ev = eigenvectors[c];
    if (eigenvalues[c] < 0.001) continue;
    
    for (let i = 0; i < X.length; i++) {
      for (let j = 0; j < X[i].length; j++) {
        trendTrajectory[i][j] += ev[i] * X[i][j] * ev[i];
      }
    }
  }
  
  const trend: number[] = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - windowLength + 1); j <= Math.min(i, X[0].length - 1); j++) {
      const row = i - j;
      if (row >= 0 && row < trendTrajectory.length && j < trendTrajectory[row].length) {
        sum += trendTrajectory[row][j];
        count++;
      }
    }
    trend.push(count > 0 ? sum / count : data[i]);
  }
  
  const residual = data.map((d, i) => d - trend[i]);
  
  return { trend, residual };
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

export interface StratIter91DParams extends StrategyParams {
  ssa_window: number;
  num_components: number;
  residual_threshold: number;
  stoch_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter91DStrategy extends BaseIterStrategy<StratIter91DParams> {
  private residuals: Map<string, number[]> = new Map();
  private prevResidual: Map<string, number> = new Map();

  constructor(params: Partial<StratIter91DParams> = {}) {
    super('strat_iter91_d.params.json', {
      ssa_window: 20,
      num_components: 2,
      residual_threshold: 0.015,
      stoch_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.16,
      max_hold_bars: 24,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_period);

    if (!this.residuals.has(bar.tokenId)) {
      this.residuals.set(bar.tokenId, []);
      this.prevResidual.set(bar.tokenId, 0);
    }

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || k === null) return;
    if (series.closes.length < this.params.ssa_window * 2) return;

    const window = series.closes.slice(-this.params.ssa_window * 2);
    const { trend, residual } = ssaDecompose(window, this.params.ssa_window, this.params.num_components);
    
    const currentResidual = residual[residual.length - 1];
    const prevRes = this.prevResidual.get(bar.tokenId)!;
    const normalizedResidual = Math.abs(currentResidual) / bar.close;
    this.prevResidual.set(bar.tokenId, currentResidual);
    
    const residualArr = this.residuals.get(bar.tokenId)!;
    capPush(residualArr, currentResidual, 100);
    
    let residualTrough = false;
    if (residualArr.length >= 5) {
      const recent = residualArr.slice(-5);
      const minVal = Math.min(...recent);
      residualTrough = Math.abs(currentResidual - minVal) < Math.abs(currentResidual) * 0.1 && currentResidual < 0;
    }
    
    const extremeResidual = normalizedResidual > this.params.residual_threshold;
    const stochOversold = k < this.params.stoch_oversold;

    if ((residualTrough || extremeResidual) && stochOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
