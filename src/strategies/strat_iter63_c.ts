import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  compressedState: number[];
  mutualInfo: number[];
  compressionRatio: number[];
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

function histogramEntropy(values: number[], bins: number): number {
  if (values.length < 2) return 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 1e-10) return 0;
  
  const binWidth = (max - min) / bins;
  const counts = new Array(bins).fill(0);
  
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    counts[idx]++;
  }
  
  let entropy = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / values.length;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

function computeCompressionRatio(data: number[], compressedDim: number): number {
  if (data.length < compressedDim * 2) return 1;
  
  const chunkSize = Math.floor(data.length / compressedDim);
  const compressed: number[] = [];
  
  for (let i = 0; i < compressedDim; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, data.length);
    const chunk = data.slice(start, end);
    compressed.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
  }
  
  const origEntropy = histogramEntropy(data, 10);
  const compEntropy = histogramEntropy(compressed, 5);
  
  return origEntropy > 0 ? compEntropy / origEntropy : 1;
}

function estimateMutualInformation(past: number[], future: number[], bins: number): number {
  if (past.length < 5 || future.length < 5) return 0;
  
  const jointData: [number, number][] = [];
  const n = Math.min(past.length, future.length);
  for (let i = 0; i < n; i++) {
    jointData.push([past[past.length - n + i], future[future.length - n + i]]);
  }
  
  const pastMin = Math.min(...past);
  const pastMax = Math.max(...past);
  const futureMin = Math.min(...future);
  const futureMax = Math.max(...future);
  
  const pastRange = pastMax - pastMin || 1;
  const futureRange = futureMax - futureMin || 1;
  
  const jointCounts: Map<string, number> = new Map();
  const pastCounts: Map<number, number> = new Map();
  const futureCounts: Map<number, number> = new Map();
  
  for (const [p, f] of jointData) {
    const pb = Math.floor((p - pastMin) / pastRange * bins);
    const fb = Math.floor((f - futureMin) / futureRange * bins);
    const key = `${pb},${fb}`;
    jointCounts.set(key, (jointCounts.get(key) || 0) + 1);
    pastCounts.set(pb, (pastCounts.get(pb) || 0) + 1);
    futureCounts.set(fb, (futureCounts.get(fb) || 0) + 1);
  }
  
  const total = jointData.length;
  let mi = 0;
  
  for (const [key, jc] of jointCounts) {
    const [pb, fb] = key.split(',').map(Number);
    const pc = pastCounts.get(pb) || 1;
    const fc = futureCounts.get(fb) || 1;
    const p_joint = jc / total;
    const p_past = pc / total;
    const p_future = fc / total;
    
    if (p_joint > 0 && p_past > 0 && p_future > 0) {
      mi += p_joint * Math.log2(p_joint / (p_past * p_future));
    }
  }
  
  return Math.max(0, mi);
}

export interface StratIter63CParams extends StrategyParams {
  compression_dim: number;
  info_window: number;
  mi_horizon: number;
  compression_threshold: number;
  mi_threshold: number;
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

export class StratIter63CStrategy implements Strategy {
  params: StratIter63CParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter63CParams> = {}) {
    const saved = loadSavedParams<StratIter63CParams>('strat_iter63_c.params.json');
    this.params = {
      compression_dim: 8,
      info_window: 40,
      mi_horizon: 5,
      compression_threshold: 0.7,
      mi_threshold: 0.15,
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
    } as StratIter63CParams;
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
      compressedState: [],
      mutualInfo: [],
      compressionRatio: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeIBMetrics(s: TokenState): { compression: number; mi: number } {
    if (s.returns.length < 30) return { compression: 1, mi: 0 };

    const window = Math.floor(this.params.info_window);
    const recent = s.returns.slice(-window);
    const compDim = Math.max(2, Math.floor(this.params.compression_dim));
    
    const compression = computeCompressionRatio(recent, compDim);
    
    const horizon = Math.floor(this.params.mi_horizon);
    const past = recent.slice(0, -horizon);
    const future = recent.slice(horizon);
    
    const mi = estimateMutualInformation(past, future, 6);
    
    return { compression, mi };
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

    const { compression, mi } = this.computeIBMetrics(s);
    capPush(s.compressionRatio, compression, 800);
    capPush(s.mutualInfo, mi, 800);

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

    let ibSignal = false;
    if (s.compressionRatio.length > 0 && s.mutualInfo.length > 0) {
      const comp = s.compressionRatio[s.compressionRatio.length - 1];
      const miVal = s.mutualInfo[s.mutualInfo.length - 1];
      ibSignal = comp > this.params.compression_threshold && miVal < this.params.mi_threshold;
    }

    if (nearSupport && supportReclaim && stochRebound && ibSignal) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
