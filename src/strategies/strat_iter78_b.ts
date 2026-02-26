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
    if (closes[i - 1] > 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  return returns;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[], m?: number): number {
  if (arr.length === 0) return 0;
  const mu = m ?? mean(arr);
  return Math.sqrt(arr.reduce((sum, x) => sum + Math.pow(x - mu, 2), 0) / arr.length);
}

function autocorr(x: number[], lag: number): number {
  if (x.length < lag + 2) return 0;
  const mu = mean(x);
  const sigma = std(x, mu);
  if (sigma === 0) return 0;
  
  let sum = 0;
  for (let i = lag; i < x.length; i++) {
    sum += (x[i] - mu) * (x[i - lag] - mu);
  }
  return sum / ((x.length - lag) * sigma * sigma);
}

function computePACF(returns: number[], maxLag: number): number[] {
  const pacf: number[] = [1];
  
  if (returns.length < maxLag + 10) return pacf;
  
  for (let k = 1; k <= maxLag; k++) {
    const r = new Array(k + 1).fill(0);
    for (let i = 0; i <= k; i++) {
      r[i] = autocorr(returns, i);
    }
    
    const R: number[][] = [];
    for (let i = 0; i < k; i++) {
      R.push([]);
      for (let j = 0; j < k; j++) {
        R[i].push(r[Math.abs(i - j)]);
      }
    }
    
    const rVec = r.slice(1, k + 1);
    
    let phiKK = r[1];
    if (k > 1) {
      const phi = solveLinearSystem(R, rVec);
      if (phi && phi.length === k) {
        phiKK = phi[k - 1];
      }
    }
    
    pacf.push(phiKK);
  }
  
  return pacf;
}

function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  if (n === 0 || b.length !== n) return null;
  
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);
  
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    
    if (Math.abs(aug[col][col]) < 1e-10) continue;
    
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }
  
  const x: number[] = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(aug[i][i]) < 1e-10) continue;
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= aug[i][i];
  }
  
  return x;
}

function findCutoffLag(pacf: number[], n: number): number {
  if (pacf.length < 2) return 0;
  
  const threshold = 1.96 / Math.sqrt(n);
  
  for (let k = pacf.length - 1; k >= 1; k--) {
    if (Math.abs(pacf[k]) > threshold) {
      return k;
    }
  }
  
  return 1;
}

function fitARModel(returns: number[], order: number): number[] | null {
  if (returns.length < order + 10) return null;
  
  const n = returns.length - order;
  const X: number[][] = [];
  const y: number[] = [];
  
  for (let i = order; i < returns.length; i++) {
    const row: number[] = [];
    for (let j = 1; j <= order; j++) {
      row.push(returns[i - j]);
    }
    X.push(row);
    y.push(returns[i]);
  }
  
  if (X.length < order + 5) return null;
  
  const XtX: number[][] = [];
  for (let i = 0; i < order; i++) {
    XtX.push([]);
    for (let j = 0; j < order; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      XtX[i].push(sum);
    }
  }
  
  const Xty: number[] = [];
  for (let i = 0; i < order; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * y[k];
    }
    Xty.push(sum);
  }
  
  return solveLinearSystem(XtX, Xty);
}

function predictNextReturn(returns: number[], coefficients: number[]): number {
  if (returns.length < coefficients.length) return 0;
  
  let prediction = 0;
  for (let i = 0; i < coefficients.length; i++) {
    prediction += coefficients[i] * returns[returns.length - 1 - i];
  }
  
  return prediction;
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

export interface StratIter78BParams extends StrategyParams {
  max_lag: number;
  window_size: number;
  prediction_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter78BStrategy extends BaseIterStrategy<StratIter78BParams> {
  constructor(params: Partial<StratIter78BParams> = {}) {
    super('strat_iter78_b.params.json', {
      max_lag: 5,
      window_size: 40,
      prediction_threshold: 0.003,
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
    if (series.closes.length < this.params.window_size + this.params.max_lag + 5) return;

    const windowCloses = series.closes.slice(-this.params.window_size - this.params.max_lag - 2);
    const returns = computeReturns(windowCloses);
    
    if (returns.length < this.params.window_size * 0.8) return;

    const pacf = computePACF(returns, this.params.max_lag);
    const arOrder = findCutoffLag(pacf, returns.length);
    
    if (arOrder < 1 || arOrder > this.params.max_lag) return;

    const coefficients = fitARModel(returns, arOrder);
    if (!coefficients) return;

    const prediction = predictNextReturn(returns, coefficients);
    
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const positivePrediction = prediction > this.params.prediction_threshold;

    if (nearSupport && stochOversold && positivePrediction) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
