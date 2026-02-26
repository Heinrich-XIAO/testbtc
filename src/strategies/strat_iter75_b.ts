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

function computeReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const r = (closes[i] - closes[i - 1]) / closes[i - 1];
    returns.push(isFinite(r) ? r : 0);
  }
  return returns;
}

function normalizeVector(v: number[]): { mean: number; std: number; normalized: number[] } {
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const variance = v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length;
  const std = Math.sqrt(variance) || 1;
  return { mean, std, normalized: v.map(x => (x - mean) / std) };
}

function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const n = B[0].length;
  const p = B.length;
  const C: number[][] = [];
  for (let i = 0; i < m; i++) {
    C[i] = [];
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < p; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

function transpose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0].length;
  const T: number[][] = [];
  for (let j = 0; j < cols; j++) {
    T[j] = [];
    for (let i = 0; i < rows; i++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

function powerIteration(A: number[][], numIterations: number = 100): { eigenvalue: number; eigenvector: number[] } {
  const n = A.length;
  let v: number[] = [];
  for (let i = 0; i < n; i++) {
    v.push(Math.random() - 0.5);
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  v = v.map(x => x / norm);

  for (let iter = 0; iter < numIterations; iter++) {
    const Av: number[] = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += A[i][j] * v[j];
      }
      Av.push(sum);
    }
    const newNorm = Math.sqrt(Av.reduce((s, x) => s + x * x, 0)) || 1;
    v = Av.map(x => x / newNorm);
  }

  const Av: number[] = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += A[i][j] * v[j];
    }
    Av.push(sum);
  }
  const eigenvalue = v.reduce((s, x, i) => s + x * Av[i], 0);

  return { eigenvalue, eigenvector: v };
}

function deflate(A: number[][], eigenvalue: number, eigenvector: number[]): number[][] {
  const n = A.length;
  const deflated: number[][] = [];
  for (let i = 0; i < n; i++) {
    deflated[i] = [];
    for (let j = 0; j < n; j++) {
      deflated[i][j] = A[i][j] - eigenvalue * eigenvector[i] * eigenvector[j];
    }
  }
  return deflated;
}

function computePCA(data: number[][], nComponents: number): { components: number[][]; means: number[] } | null {
  if (data.length === 0 || data[0].length === 0) return null;
  
  const n = data.length;
  const d = data[0].length;

  const means: number[] = [];
  for (let j = 0; j < d; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += data[i][j];
    }
    means.push(sum / n);
  }

  const centered: number[][] = [];
  for (let i = 0; i < n; i++) {
    centered[i] = [];
    for (let j = 0; j < d; j++) {
      centered[i][j] = data[i][j] - means[j];
    }
  }

  const C = matrixMultiply(transpose(centered), centered);
  for (let i = 0; i < C.length; i++) {
    for (let j = 0; j < C[0].length; j++) {
      C[i][j] /= n;
    }
  }

  const components: number[][] = [];
  let deflatedMatrix = C;
  
  for (let k = 0; k < nComponents && k < d; k++) {
    const { eigenvalue, eigenvector } = powerIteration(deflatedMatrix);
    components.push(eigenvector);
    deflatedMatrix = deflate(deflatedMatrix, eigenvalue, eigenvector);
  }

  return { components, means };
}

function projectAndReconstruct(window: number[], components: number[][], means: number[]): number {
  const centered = window.map((x, i) => x - means[i]);

  const scores: number[] = [];
  for (const comp of components) {
    let dot = 0;
    for (let i = 0; i < centered.length; i++) {
      dot += centered[i] * comp[i];
    }
    scores.push(dot);
  }

  const reconstructed: number[] = [];
  for (let i = 0; i < window.length; i++) {
    let val = means[i];
    for (let k = 0; k < components.length; k++) {
      val += scores[k] * components[k][i];
    }
    reconstructed.push(val);
  }

  let error = 0;
  for (let i = 0; i < window.length; i++) {
    error += (window[i] - reconstructed[i]) ** 2;
  }
  return Math.sqrt(error / window.length);
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

export interface StratIter75BParams extends StrategyParams {
  window_size: number;
  n_components: number;
  history_size: number;
  error_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter75BStrategy extends BaseIterStrategy<StratIter75BParams> {
  constructor(params: Partial<StratIter75BParams> = {}) {
    super('strat_iter75_b.params.json', {
      window_size: 15,
      n_components: 3,
      history_size: 75,
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

    if (shouldSkipPrice(bar.close) || !sr) return;
    if (series.closes.length < this.params.history_size + this.params.window_size) return;

    const returns = computeReturns(series.closes);
    if (returns.length < this.params.history_size + this.params.window_size - 1) return;

    const windows: number[][] = [];
    for (let i = 0; i <= returns.length - this.params.window_size; i++) {
      const win = returns.slice(i, i + this.params.window_size);
      const { normalized } = normalizeVector(win);
      windows.push(normalized);
    }

    const historyWindows = windows.slice(-this.params.history_size - 1, -1);
    const currentWindow = windows[windows.length - 1];

    if (historyWindows.length < this.params.history_size || !currentWindow) return;

    const pcaResult = computePCA(historyWindows, this.params.n_components);
    if (!pcaResult) return;

    const avgMeans = pcaResult.means;
    const reconError = projectAndReconstruct(currentWindow, pcaResult.components, avgMeans);

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const lowError = reconError < this.params.error_threshold;

    if (nearSupport && stochOversold && lowError) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
