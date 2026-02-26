import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  featureVectors: number[][];
  somWeights: number[][];
  bmuDistances: number[];
  quantizationError: number[];
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

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

function euclidean(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function initSOM(rows: number, cols: number, inputDim: number): number[][] {
  const weights: number[][] = [];
  for (let i = 0; i < rows * cols; i++) {
    const row: number[] = [];
    for (let j = 0; j < inputDim; j++) {
      row.push(Math.random() * 2 - 1);
    }
    weights.push(row);
  }
  return weights;
}

function findBMU(weights: number[][], input: number[]): { index: number; distance: number } {
  let minDist = Infinity;
  let bmuIndex = 0;
  
  for (let i = 0; i < weights.length; i++) {
    const d = euclidean(weights[i], input);
    if (d < minDist) {
      minDist = d;
      bmuIndex = i;
    }
  }
  
  return { index: bmuIndex, distance: minDist };
}

function trainSOM(weights: number[][], input: number[], bmuIndex: number, learningRate: number, radius: number, rows: number, cols: number): void {
  const bmuRow = Math.floor(bmuIndex / cols);
  const bmuCol = bmuIndex % cols;
  
  for (let i = 0; i < weights.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const dist = Math.sqrt((row - bmuRow) ** 2 + (col - bmuCol) ** 2);
    
    if (dist <= radius) {
      const distSq = dist * dist;
      const radSq = radius * radius;
      const influence = Math.exp(-distSq / (2 * radSq));
      for (let j = 0; j < weights[i].length; j++) {
        weights[i][j] += influence * learningRate * (input[j] - weights[i][j]);
      }
    }
  }
}

export interface StratIter63DParams extends StrategyParams {
  som_rows: number;
  som_cols: number;
  feature_dim: number;
  lookback: number;
  initial_lr: number;
  radius: number;
  distance_threshold: number;
  quant_error_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stoch_rebound_delta: number;
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter63DStrategy implements Strategy {
  params: StratIter63DParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private globalSOM: number[][] = [];

  constructor(params: Partial<StratIter63DParams> = {}) {
    const saved = loadSavedParams<StratIter63DParams>('strat_iter63_d.params.json');
    this.params = {
      som_rows: 3,
      som_cols: 3,
      feature_dim: 5,
      lookback: 25,
      initial_lr: 0.2,
      radius: 1.5,
      distance_threshold: 0.8,
      quant_error_threshold: 0.15,
      stoch_k_period: 14,
      stoch_oversold: 16,
      stoch_overbought: 84,
      stoch_rebound_delta: 3,
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter63DParams;
    
    this.initGlobalSOM();
  }

  private initGlobalSOM(): void {
    this.globalSOM = initSOM(
      this.params.som_rows,
      this.params.som_cols,
      this.params.feature_dim
    );
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
      featureVectors: [],
      somWeights: this.globalSOM.map(row => [...row]),
      bmuDistances: [],
      quantizationError: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private extractFeatureVector(closes: number[], highs: number[], lows: number[], stoch: number | null): number[] {
    const lookback = Math.floor(this.params.lookback);
    const features: number[] = [];
    
    if (closes.length >= 5) {
      const recent = closes.slice(-5);
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
      const std = Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length);
      features.push((closes[closes.length - 1] - mean) / (std || 1));
    } else {
      features.push(0);
    }
    
    if (highs.length >= lookback && lows.length >= lookback) {
      const recentHigh = Math.max(...highs.slice(-lookback));
      const recentLow = Math.min(...lows.slice(-lookback));
      const range = recentHigh - recentLow || 1;
      features.push((closes[closes.length - 1] - recentLow) / range);
    } else {
      features.push(0.5);
    }
    
    if (stoch !== null) {
      features.push(stoch / 100);
    } else {
      features.push(0.5);
    }
    
    if (closes.length >= 3) {
      const ret1 = (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2];
      const ret2 = (closes[closes.length - 2] - closes[closes.length - 3]) / closes[closes.length - 3];
      features.push(Math.tanh(ret1 * 10));
      features.push(Math.tanh((ret1 - ret2) * 50));
    } else {
      features.push(0, 0);
    }
    
    while (features.length < this.params.feature_dim) {
      features.push(0);
    }
    return features.slice(0, this.params.feature_dim);
  }

  private computeSOMMetrics(s: TokenState, input: number[]): { bmuDist: number; quantError: number } {
    const rows = this.params.som_rows;
    const cols = this.params.som_cols;
    
    const { index, distance } = findBMU(s.somWeights, input);
    
    const lr = Math.max(0.01, this.params.initial_lr * Math.exp(-s.barNum / 100));
    const radius = Math.max(0.5, this.params.radius * Math.exp(-s.barNum / 100));
    
    trainSOM(s.somWeights, input, index, lr, radius, rows, cols);
    
    const allDistances = s.somWeights.map(w => euclidean(w, input));
    const quantError = allDistances.reduce((a, b) => a + b, 0) / allDistances.length;
    
    return { bmuDist: distance, quantError };
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

    const k = stochK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));
    if (k !== null) capPush(s.stoch, k, 800);

    const features = this.extractFeatureVector(s.closes, s.highs, s.lows, k);
    const featureHash = features.reduce((a, b) => a + b * 1000, 0);
    capPush(s.featureVectors as any, featureHash, 800);
    
    const somResult = this.computeSOMMetrics(s, features);
    const bmuDistVal = somResult.bmuDist;
    const quantErrorVal = somResult.quantError;
    capPush(s.bmuDistances, bmuDistVal, 800);
    capPush(s.quantizationError, quantErrorVal, 800);

    const sr = priorSupportResistance(s.highs, s.lows, this.params.sr_lookback);
    if (!sr) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = s.barNum - enteredBar >= this.params.max_hold_bars;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (k === null || s.stoch.length < 2 || s.bmuDistances.length < 2) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = k <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);

    const bmuDist = s.bmuDistances[s.bmuDistances.length - 1];
    const quantError = s.quantizationError[s.quantizationError.length - 1];
    const somSignal = bmuDist > this.params.distance_threshold || quantError < this.params.quant_error_threshold;

    if (nearSupport && supportReclaim && stochRebound && somSignal) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
