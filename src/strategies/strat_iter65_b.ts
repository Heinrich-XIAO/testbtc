import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  eigenvalueSpread: number[];
  regimeSignal: number;
  correlationMatrix: number[][];
  barNum: number;
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

function capPush(values: number[], value: number, max = 1200): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function computeEigenvalueSpread(returns: number[], lookback: number, numAssets: number): number {
  if (returns.length < lookback * numAssets) return 0.5;
  
  const windows = Math.floor(returns.length / numAssets);
  const matrix: number[][] = [];
  
  for (let i = 0; i < numAssets; i++) {
    const start = Math.max(0, returns.length - (windows - i) * numAssets);
    const end = Math.min(returns.length, returns.length - i);
    const windowReturns = returns.slice(start, end);
    matrix.push(windowReturns.slice(-lookback));
  }
  
  if (matrix.length < 2 || matrix[0].length < 2) return 0.5;
  
  const means = matrix.map(row => row.reduce((a, b) => a + b, 0) / row.length);
  const centered = matrix.map((row, i) => row.map(v => v - means[i]));
  
  const covMatrix: number[][] = [];
  for (let i = 0; i < numAssets; i++) {
    covMatrix[i] = [];
    for (let j = 0; j < numAssets; j++) {
      let sum = 0;
      const len = Math.min(centered[i].length, centered[j].length);
      for (let k = 0; k < len; k++) {
        sum += centered[i][k] * centered[j][k];
      }
      covMatrix[i][j] = sum / (len - 1);
    }
  }
  
  const eigenvalues = powerIterationEigenvalues(covMatrix, 3);
  
  if (eigenvalues.length < 2) return 0.5;
  
  const maxEigen = eigenvalues[0];
  const minEigen = eigenvalues[eigenvalues.length - 1];
  const spread = (maxEigen - minEigen) / (maxEigen + 0.0001);
  
  return spread;
}

function powerIterationEigenvalues(matrix: number[][], numEigen: number): number[] {
  const n = matrix.length;
  if (n === 0) return [];
  
  let vector = new Array(n).fill(1).map(() => Math.random());
  
  for (let iter = 0; iter < 20; iter++) {
    const newVector = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        newVector[i] += matrix[i][j] * vector[j];
      }
    }
    
    const norm = Math.sqrt(newVector.reduce((a, b) => a + b * b, 0));
    vector = newVector.map(v => v / (norm + 0.0001));
  }
  
  const eigenvalues: number[] = [];
  for (let i = 0; i < Math.min(numEigen, n); i++) {
    const shifted = matrix.map((row, ri) => 
      row.map((v, ci) => v - (i > 0 ? eigenvalues[i-1] * (i === 1 ? 1 : 0) : 0))
    );
    
    let v = new Array(n).fill(1);
    for (let iter = 0; iter < 15; iter++) {
      const newV = new Array(n).fill(0);
      for (let ri = 0; ri < n; ri++) {
        for (let ci = 0; ci < n; ci++) {
          newV[ri] += shifted[ri][ci] * v[ci];
        }
      }
      const norm = Math.sqrt(newV.reduce((a, b) => a + b * b, 0));
      if (norm > 0.0001) v = newV.map(x => x / norm);
    }
    
    let eigenvalue = 0;
    for (let ri = 0; ri < n; ri++) {
      for (let ci = 0; ci < n; ci++) {
        eigenvalue += v[ri] * shifted[ri][ci] * v[ci];
      }
    }
    eigenvalues.push(Math.abs(eigenvalue));
  }
  
  return eigenvalues.sort((a, b) => b - a);
}

function computeRegimeSignal(eigenvalueSpreads: number[], threshold: number): number {
  if (eigenvalueSpreads.length < 3) return 0;
  
  const recent = eigenvalueSpreads.slice(-3);
  const avg = recent.reduce((a, b) => a + b, 0) / 3;
  
  if (avg > threshold) return 1;
  if (avg < threshold * 0.7) return -1;
  return 0;
}

function priorSupport(highs: number[], lows: number[], lookback: number): number | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return Math.min(...lows.slice(-(lookback + 1), -1));
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

export interface StratIter65BParams extends StrategyParams {
  rmt_lookback: number;
  rmt_num_assets: number;
  rmt_spread_threshold: number;
  rmt_regime_require: number;
  lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stoch_rebound_delta: number;
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter65BStrategy implements Strategy {
  params: StratIter65BParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter65BParams> = {}) {
    const saved = loadSavedParams<StratIter65BParams>('strat_iter65_b.params.json');
    this.params = {
      rmt_lookback: 20,
      rmt_num_assets: 5,
      rmt_spread_threshold: 0.6,
      rmt_regime_require: 1,
      lookback: 30,
      stoch_k_period: 14,
      stoch_oversold: 16,
      stoch_overbought: 84,
      stoch_rebound_delta: 3,
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter65BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private getState(tokenId: string): TokenState {
    let s = this.state.get(tokenId);
    if (s) return s;

    s = {
      closes: [],
      highs: [],
      lows: [],
      returns: [],
      stoch: [],
      eigenvalueSpread: [],
      regimeSignal: 0,
      correlationMatrix: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeRMT(s: TokenState): void {
    const lookback = Math.floor(this.params.rmt_lookback);
    const numAssets = Math.floor(this.params.rmt_num_assets);
    
    if (s.returns.length >= lookback * numAssets) {
      const spread = computeEigenvalueSpread(s.returns, lookback, numAssets);
      capPush(s.eigenvalueSpread, spread);
      
      if (s.eigenvalueSpread.length >= 3) {
        s.regimeSignal = computeRegimeSignal(s.eigenvalueSpread, this.params.rmt_spread_threshold);
      }
    }
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;

    const result = ctx.buy(bar.tokenId, size);
    if (!result.success) return false;

    this.entryPrice.set(bar.tokenId, bar.close);
    this.entryBar.set(bar.tokenId, barNum);
    return true;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (shouldSkipPrice(bar.close)) return;

    const s = this.getState(bar.tokenId);
    s.barNum += 1;

    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;
    const ret = prevClose && prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    capPush(s.returns, ret, 800);

    this.computeRMT(s);

    const k = stochK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));
    if (k !== null) {
      s.stoch.push(k);
      if (s.stoch.length > 100) s.stoch.shift();
    }

    const sr = priorSupport(s.highs, s.lows, this.params.sr_lookback);
    if (!sr) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const maxHoldReached = s.barNum - enteredBar >= this.params.max_hold_bars;

      if (stopLossHit || profitTargetHit || maxHoldReached) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (k === null || s.stoch.length < 2 || s.eigenvalueSpread.length < 3) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const regimeValid = s.regimeSignal === this.params.rmt_regime_require;

    if (nearSupport && supportReclaim && stochRebound && regimeValid) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
