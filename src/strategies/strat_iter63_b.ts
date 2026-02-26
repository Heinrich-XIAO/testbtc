import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  embedVectors: number[][];
  distances: number[];
  lyapunov: number[];
  stoch: number[];
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
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum / n);
}

function correlationDimension(returns: number[], embedDim: number, tau: number): number | null {
  const vectors: number[][] = [];
  const n = returns.length - (embedDim - 1) * tau;
  if (n < 8) return null;

  for (let i = 0; i < n; i++) {
    const vec: number[] = [];
    for (let j = 0; j < embedDim; j++) {
      vec.push(returns[i + j * tau]);
    }
    vectors.push(vec);
  }

  const epsilons = [0.005, 0.01, 0.03];
  const counts: number[] = [];

  for (const eps of epsilons) {
    let count = 0;
    for (let i = 0; i < Math.min(vectors.length, 50); i++) {
      for (let j = i + 1; j < Math.min(vectors.length, 50); j++) {
        if (euclidean(vectors[i], vectors[j]) < eps) {
          count++;
        }
      }
    }
    counts.push(count);
  }

  if (counts.length < 2) return 1;
  
  let totalD = 0;
  let validPairs = 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] > 0 && counts[i - 1] > 0) {
      const d = Math.log(counts[i] / counts[i - 1]) / Math.log(epsilons[i] / epsilons[i - 1]);
      if (isFinite(d) && d > 0 && d < 10) {
        totalD += d;
        validPairs++;
      }
    }
  }

  return validPairs > 0 ? totalD / validPairs : 1;
}

function estimateLocalLyapunov(returns: number[], embedDim: number, tau: number, horizon: number): number | null {
  const vectors: number[][] = [];
  const n = returns.length - (embedDim - 1) * tau - horizon;
  if (n < 6) return null;

  for (let i = 0; i < Math.min(n, 40); i++) {
    const vec: number[] = [];
    for (let j = 0; j < embedDim; j++) {
      vec.push(returns[i + j * tau]);
    }
    vectors.push(vec);
  }

  const eps = 0.02;
  const lyaps: number[] = [];

  for (let i = 0; i < vectors.length; i++) {
    let nearestDist = Infinity;
    let nearestFutureDist = Infinity;

    for (let j = 0; j < vectors.length; j++) {
      if (i === j) continue;
      const d = euclidean(vectors[i], vectors[j]);
      if (d < eps && d > 0.0001) {
        if (d < nearestDist) {
          nearestDist = d;
          const idxI = i + horizon;
          const idxJ = j + horizon;
          if (idxI < vectors.length && idxJ < vectors.length) {
            nearestFutureDist = euclidean(vectors[idxI], vectors[idxJ]);
          }
        }
      }
    }

    if (nearestDist > 0.0001 && nearestFutureDist < Infinity) {
      const lyap = Math.log(nearestFutureDist / nearestDist) / horizon;
      if (isFinite(lyap) && Math.abs(lyap) < 5) {
        lyaps.push(lyap);
      }
    }
  }

  return lyaps.length > 2 ? lyaps.reduce((a, b) => a + b, 0) / lyaps.length : null;
}

export interface StratIter63BParams extends StrategyParams {
  embed_dim: number;
  time_delay: number;
  lyapunov_horizon: number;
  correlation_threshold: number;
  lyapunov_threshold: number;
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

export class StratIter63BStrategy implements Strategy {
  params: StratIter63BParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter63BParams> = {}) {
    const saved = loadSavedParams<StratIter63BParams>('strat_iter63_b.params.json');
    this.params = {
      embed_dim: 4,
      time_delay: 2,
      lyapunov_horizon: 3,
      correlation_threshold: 1.8,
      lyapunov_threshold: -0.15,
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
    } as StratIter63BParams;
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
      embedVectors: [],
      distances: [],
      lyapunov: [],
      stoch: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeAttractorMetrics(s: TokenState): { corrDim: number | null; lyap: number | null } {
    if (s.returns.length < 25) return { corrDim: null, lyap: null };

    const dim = Math.max(2, Math.floor(this.params.embed_dim));
    const tau = Math.max(1, Math.floor(this.params.time_delay));
    const horizon = Math.max(1, Math.floor(this.params.lyapunov_horizon));

    const window = 20;
    const recent = s.returns.slice(-window);
    
    let sum = 0;
    for (let i = 1; i < recent.length; i++) {
      sum += Math.abs(recent[i] - recent[i-1]);
    }
    const corrDim = sum / (recent.length - 1) + 1;
    
    const lyap = -Math.log(Math.abs(recent[recent.length-1]) + 0.001) * 0.1;

    return { corrDim, lyap };
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

    const { corrDim, lyap } = this.computeAttractorMetrics(s);
    if (corrDim !== null) capPush(s.distances, corrDim, 800);
    if (lyap !== null) capPush(s.lyapunov, lyap, 800);

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

    if (k === null || s.stoch.length < 2) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = k <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);

    let attractorSignal = false;
    if (s.distances.length > 0 && s.lyapunov.length > 0) {
      const cd = s.distances[s.distances.length - 1];
      const ly = s.lyapunov[s.lyapunov.length - 1];
      attractorSignal = cd < this.params.correlation_threshold || ly < this.params.lyapunov_threshold;
    }

    if (nearSupport && supportReclaim && stochRebound && attractorSignal) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
