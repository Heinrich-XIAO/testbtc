import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  waveletEntropy: number[];
  energyRatios: number[];
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

function haarWaveletTransform(signal: number[]): [number[], number[]] {
  if (signal.length < 2) return [signal, []];
  
  const n = Math.floor(signal.length / 2) * 2;
  const approx = new Array(n / 2);
  const detail = new Array(n / 2);
  
  for (let i = 0; i < n / 2; i++) {
    approx[i] = (signal[2 * i] + signal[2 * i + 1]) / Math.sqrt(2);
    detail[i] = (signal[2 * i] - signal[2 * i + 1]) / Math.sqrt(2);
  }
  
  return [approx, detail];
}

function computeWaveletPacketDecomposition(signal: number[], levels: number): number[][] {
  const packets: number[][] = [signal];
  
  for (let level = 0; level < levels; level++) {
    const current = packets[packets.length - 1];
    const [approx, detail] = haarWaveletTransform(current);
    
    if (approx.length > 0) packets.push(approx);
    if (detail.length > 0) packets.push(detail);
    
    if (approx.length < 2) break;
  }
  
  return packets;
}

function computeShannonEntropy(values: number[]): number {
  if (values.length === 0) return 0;
  
  const total = values.reduce((a, b) => a + Math.abs(b), 0);
  if (total === 0) return 0;
  
  const probabilities = values.map(v => Math.abs(v) / total);
  let entropy = 0;
  
  for (const p of probabilities) {
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }
  
  return entropy;
}

function computeEnergyRatio(packets: number[][]): number {
  if (packets.length < 2) return 0.5;
  
  const energies = packets.map(p => 
    p.reduce((sum, v) => sum + v * v, 0)
  );
  
  const totalEnergy = energies.reduce((a, b) => a + b, 0);
  if (totalEnergy === 0) return 0.5;
  
  const lowFreqEnergy = energies.slice(0, Math.ceil(energies.length / 2))
    .reduce((a, b) => a + b, 0);
  
  return lowFreqEnergy / totalEnergy;
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

export interface StratIter65CParams extends StrategyParams {
  wavelet_lookback: number;
  wavelet_levels: number;
  entropy_threshold_low: number;
  entropy_threshold_high: number;
  energy_ratio_low: number;
  energy_ratio_high: number;
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

export class StratIter65CStrategy implements Strategy {
  params: StratIter65CParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter65CParams> = {}) {
    const saved = loadSavedParams<StratIter65CParams>('strat_iter65_c.params.json');
    this.params = {
      wavelet_lookback: 32,
      wavelet_levels: 3,
      entropy_threshold_low: 0.3,
      entropy_threshold_high: 0.7,
      energy_ratio_low: 0.4,
      energy_ratio_high: 0.75,
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
    } as StratIter65CParams;
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
      waveletEntropy: [],
      energyRatios: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeWaveletFeatures(s: TokenState): void {
    const lookback = Math.floor(this.params.wavelet_lookback);
    const levels = Math.floor(this.params.wavelet_levels);
    
    if (s.returns.length >= lookback) {
      const subset = s.returns.slice(-lookback);
      const packets = computeWaveletPacketDecomposition(subset, levels);
      
      const entropy = computeShannonEntropy(packets[packets.length - 1]);
      capPush(s.waveletEntropy, entropy);
      
      const energyRatio = computeEnergyRatio(packets);
      capPush(s.energyRatios, energyRatio);
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

    this.computeWaveletFeatures(s);

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

    if (k === null || s.stoch.length < 2 || s.waveletEntropy.length < 3) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const entropy = s.waveletEntropy[s.waveletEntropy.length - 1];
    const entropyValid = entropy >= this.params.entropy_threshold_low && 
                         entropy <= this.params.entropy_threshold_high;

    const energyRatio = s.energyRatios[s.energyRatios.length - 1];
    const energyValid = energyRatio >= this.params.energy_ratio_low && 
                        energyRatio <= this.params.energy_ratio_high;

    if (nearSupport && supportReclaim && stochRebound && entropyValid && energyValid) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
