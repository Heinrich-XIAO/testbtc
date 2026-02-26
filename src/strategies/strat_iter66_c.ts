import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  returns: number[];
  mseWeighted: number[];
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

function sampleEntropy(series: number[], m: number, r: number): number {
  if (series.length < m + 2) return 0;
  
  const N = series.length;
  const counts = [0, 0];
  
  for (const mm of [m, m + 1]) {
    let count = 0;
    for (let i = 0; i < N - mm; i++) {
      let match = true;
      for (let j = 0; j < mm; j++) {
        if (Math.abs(series[i + j] - series[i + j]) > r) {
          match = false;
          break;
        }
      }
      if (match) count++;
    }
    counts[mm - m] = count;
  }
  
  if (counts[1] === 0 || counts[0] === 0) return 0;
  return -Math.log(counts[1] / counts[0]);
}

function multiScaleEntropy(closes: number[], scales: number[], baseM: number, r: number): number[] {
  if (closes.length < 50) return [];
  
  const mse: number[] = [];
  
  for (const scale of scales) {
    const coarseGrained: number[] = [];
    for (let i = 0; i < closes.length; i += scale) {
      const slice = closes.slice(i, Math.min(i + scale, closes.length));
      if (slice.length > 0) {
        coarseGrained.push(slice.reduce((a, b) => a + b, 0) / slice.length);
      }
    }
    
    if (coarseGrained.length >= baseM + 2) {
      mse.push(sampleEntropy(coarseGrained, baseM, r));
    } else {
      mse.push(0);
    }
  }
  
  return mse;
}

function computeMSEWeighted(closes: number[], scales: number[], m: number, r: number): number {
  if (closes.length < 20) return 0.3;
  
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i-1] > 0) {
      returns.push((closes[i] - closes[i-1]) / closes[i-1]);
    }
  }
  
  if (returns.length < 10) return 0.3;
  
  const variance = returns.reduce((sum, r) => sum + r * r, 0) / returns.length;
  const meanAbs = returns.reduce((sum, r) => sum + Math.abs(r), 0) / returns.length;
  
  const complexity = Math.min(variance * 100 + meanAbs * 10, 1);
  
  return complexity;
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

export interface StratIter66CParams extends StrategyParams {
  mse_scale1: number;
  mse_scale2: number;
  mse_scale3: number;
  mse_scale4: number;
  mse_scale5: number;
  mse_m: number;
  mse_r: number;
  mse_low: number;
  mse_high: number;
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

export class StratIter66CStrategy implements Strategy {
  params: StratIter66CParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter66CParams> = {}) {
    const saved = loadSavedParams<StratIter66CParams>('strat_iter66_c.params.json');
    this.params = {
      mse_scale1: 1,
      mse_scale2: 2,
      mse_scale3: 3,
      mse_scale4: 4,
      mse_scale5: 5,
      mse_m: 2,
      mse_r: 0.15,
      mse_low: 0.20,
      mse_high: 0.65,
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
    } as StratIter66CParams;
  }

  private getScales(): number[] {
    return [
      this.params.mse_scale1,
      this.params.mse_scale2,
      this.params.mse_scale3,
      this.params.mse_scale4,
      this.params.mse_scale5,
    ];
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
      volumes: [],
      returns: [],
      mseWeighted: [],
      stoch: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
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

    if (s.closes.length >= 60) {
      const scales = this.getScales();
      const m = Math.floor(this.params.mse_m);
      const r = this.params.mse_r;
      const weighted = computeMSEWeighted(s.closes, scales, m, r);
      capPush(s.mseWeighted, weighted);
    }

    const k = stochK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));
    if (k !== null) {
      s.stoch = s.stoch || [];
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

    if (k === null || !s.stoch || s.stoch.length < 2 || s.mseWeighted.length < 3) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const mseVal = s.mseWeighted[s.mseWeighted.length - 1];
    const mseAvg = s.mseWeighted.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const mseValid = (mseVal >= this.params.mse_low || mseAvg >= this.params.mse_low || s.mseWeighted.length < 5);

    if (nearSupport && supportReclaim && stochRebound && mseValid) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
