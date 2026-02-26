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

function emaNext(prev: number | undefined, value: number, period: number): number {
  const alpha = 2 / (period + 1);
  if (prev === undefined) return value;
  return prev + alpha * (value - prev);
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

export interface StratIter68AParams extends StrategyParams {
  sr_lookback: number;
  memory_dim: number;
  gate_threshold: number;
  sequence_length: number;
  decay_rate: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter68AStrategy extends BaseIterStrategy<StratIter68AParams> {
  private kVals: Map<string, number[]> = new Map();
  private memoryCell: Map<string, number[]> = new Map();
  private memoryGate: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter68AParams> = {}) {
    super('strat_iter68_a.params.json', {
      sr_lookback: 50,
      memory_dim: 4,
      gate_threshold: 0.55,
      sequence_length: 5,
      decay_rate: 0.85,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  private updateMemoryCell(tokenId: string, close: number, support: number): void {
    if (!this.memoryCell.has(tokenId)) {
      this.memoryCell.set(tokenId, []);
      this.memoryGate.set(tokenId, []);
    }
    const mem = this.memoryCell.get(tokenId)!;
    const gate = this.memoryGate.get(tokenId)!;

    const deviation = Math.abs(close - support) / Math.max(support, 1e-9);
    const normalized = Math.min(1, deviation * 10);
    const gateValue = normalized > 0.02 ? 1 : 0;

    capPush(mem, normalized, this.params.memory_dim);
    capPush(gate, gateValue, this.params.memory_dim);
  }

  private getMemoryGateState(tokenId: string): number {
    const gate = this.memoryGate.get(tokenId);
    if (!gate || gate.length < this.params.sequence_length) return 0;
    
    let weightedSum = 0;
    let weightSum = 0;
    for (let i = 0; i < gate.length; i++) {
      const weight = Math.pow(this.params.decay_rate, gate.length - 1 - i);
      weightedSum += gate[i] * weight;
      weightSum += weight;
    }
    return weightSum > 0 ? weightedSum / weightSum : 0;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    if (sr) {
      this.updateMemoryCell(bar.tokenId, bar.close, sr.support);
    }

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || series.closes.length < this.params.sequence_length) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const memoryGateState = this.getMemoryGateState(bar.tokenId);

    if (nearSupport && stochRecover && memoryGateState >= this.params.gate_threshold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter68BParams extends StrategyParams {
  sr_lookback: number;
  latent_lookback: number;
  reconstruction_threshold: number;
  anomaly_window: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter68BStrategy extends BaseIterStrategy<StratIter68BParams> {
  private kVals: Map<string, number[]> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private latentMean: Map<string, number> = new Map();
  private latentStd: Map<string, number> = new Map();

  constructor(params: Partial<StratIter68BParams> = {}) {
    super('strat_iter68_b.params.json', {
      sr_lookback: 50,
      latent_lookback: 30,
      reconstruction_threshold: 1.8,
      anomaly_window: 8,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  private computeLatentStats(tokenId: string, closes: number[]): { mean: number; std: number } {
    if (closes.length < 2) return { mean: 0, std: 1 };
    const mean = closes.reduce((s, v) => s + v, 0) / closes.length;
    const variance = closes.reduce((s, v) => s + (v - mean) ** 2, 0) / closes.length;
    return { mean, std: Math.sqrt(variance) + 1e-9 };
  }

  private getReconstructionError(tokenId: string, currentPrice: number): number {
    const latentMean = this.latentMean.get(tokenId) || 0;
    const latentStd = this.latentStd.get(tokenId) || 1;
    const zScore = Math.abs(currentPrice - latentMean) / latentStd;
    return zScore;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) {
      this.kVals.set(bar.tokenId, []);
      this.priceHistory.set(bar.tokenId, []);
    }
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const hist = this.priceHistory.get(bar.tokenId)!;
    capPush(hist, bar.close, this.params.latent_lookback + 10);

    if (hist.length >= this.params.latent_lookback) {
      const window = hist.slice(-this.params.latent_lookback);
      const stats = this.computeLatentStats(bar.tokenId, window);
      this.latentMean.set(bar.tokenId, stats.mean);
      this.latentStd.set(bar.tokenId, stats.std);
    }

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || hist.length < this.params.latent_lookback) return;

    const reconstructionError = this.getReconstructionError(bar.tokenId, bar.close);
    const isAnomaly = reconstructionError > this.params.reconstruction_threshold;
    
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;

    if (nearSupport && stochRecover && isAnomaly) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter68CParams extends StrategyParams {
  sr_lookback: number;
  propagation_depth: number;
  propagation_weight: number;
  neighbor_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter68CStrategy extends BaseIterStrategy<StratIter68CParams> {
  private kVals: Map<string, number[]> = new Map();
  private supportStrength: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter68CParams> = {}) {
    super('strat_iter68_c.params.json', {
      sr_lookback: 50,
      propagation_depth: 3,
      propagation_weight: 0.7,
      neighbor_threshold: 0.02,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  private computeSupportStrength(tokenId: string, series: TokenSeries): number[] {
    const strengths: number[] = [];
    const closes = series.closes;
    const lows = series.lows;
    
    if (closes.length < this.params.sr_lookback + 1) return [0];
    
    for (let i = 0; i < this.params.propagation_depth; i++) {
      const lookback = this.params.sr_lookback - i * 10;
      if (lookback < 10) break;
      
      const windowCloses = closes.slice(-lookback);
      const windowLows = lows.slice(-lookback);
      
      const avgClose = windowCloses.reduce((s, v) => s + v, 0) / windowCloses.length;
      const minLow = Math.min(...windowLows);
      
      const touches: number[] = [];
      for (let j = 0; j < windowLows.length; j++) {
        if (Math.abs(windowLows[j] - minLow) / Math.max(minLow, 1e-9) <= this.params.neighbor_threshold) {
          touches.push(1);
        }
      }
      
      const strength = touches.length > 0 ? touches.length / windowLows.length : 0;
      strengths.push(strength);
    }
    
    return strengths;
  }

  private propagateSignal(tokenId: string): number {
    const strengths = this.supportStrength.get(tokenId);
    if (!strengths || strengths.length === 0) return 0;
    
    let propagated = 0;
    let weight = 1;
    for (const s of strengths) {
      propagated += s * weight;
      weight *= this.params.propagation_weight;
    }
    return propagated / strengths.length;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const strengths = this.computeSupportStrength(bar.tokenId, series);
    this.supportStrength.set(bar.tokenId, strengths);
    const propagatedStrength = this.propagateSignal(bar.tokenId);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const strongStructure = propagatedStrength > 0.3;

    if (nearSupport && stochRecover && strongStructure) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter68DParams extends StrategyParams {
  sr_lookback: number;
  attention_heads: number;
  attention_lookback: number;
  momentum_threshold: number;
  query_weight: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter68DStrategy extends BaseIterStrategy<StratIter68DParams> {
  private kVals: Map<string, number[]> = new Map();
  private attentionScores: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter68DParams> = {}) {
    super('strat_iter68_d.params.json', {
      sr_lookback: 50,
      attention_heads: 3,
      attention_lookback: 12,
      momentum_threshold: 0.65,
      query_weight: 0.5,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  private computeAttentionMomentum(tokenId: string, closes: number[], highs: number[], lows: number[]): number {
    if (closes.length < this.params.attention_lookback + 1) return 0;
    
    const scores: number[] = [];
    const currentPrice = closes[closes.length - 1];
    const currentHigh = highs[highs.length - 1];
    const currentLow = lows[lows.length - 1];
    
    for (let head = 0; head < this.params.attention_heads; head++) {
      const offset = head + 1;
      const lookback = Math.max(2, Math.floor(this.params.attention_lookback / offset));
      
      if (closes.length < lookback + 1) continue;
      
      const pastClose = closes[closes.length - 1 - lookback];
      const pastHigh = highs[highs.length - 1 - lookback] || pastClose;
      const pastLow = lows[lows.length - 1 - lookback] || pastClose;
      
      const priceChange = (currentPrice - pastClose) / Math.max(pastClose, 1e-9);
      const rangePosition = (currentPrice - pastLow) / Math.max(pastHigh - pastLow, 1e-9);
      const attention = Math.abs(priceChange) * (0.5 + rangePosition * 0.5);
      
      scores.push(attention);
    }
    
    if (scores.length === 0) return 0;
    return scores.reduce((s, v) => s + v, 0) / scores.length;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) {
      this.kVals.set(bar.tokenId, []);
      this.attentionScores.set(bar.tokenId, []);
    }
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const momentum = this.computeAttentionMomentum(bar.tokenId, series.closes, series.highs, series.lows);
    capPush(this.attentionScores.get(bar.tokenId)!, momentum);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const hasAttention = momentum >= this.params.momentum_threshold;

    if (nearSupport && stochRecover && hasAttention) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter68EParams extends StrategyParams {
  sr_lookback: number;
  forget_threshold: number;
  reset_bars: number;
  entry_forget_rate: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter68EStrategy extends BaseIterStrategy<StratIter68EParams> {
  private kVals: Map<string, number[]> = new Map();
  private forgetGate: Map<string, number[]> = new Map();
  private lastEntryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter68EParams> = {}) {
    super('strat_iter68_e.params.json', {
      sr_lookback: 50,
      forget_threshold: 0.4,
      reset_bars: 10,
      entry_forget_rate: 0.6,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  private computeForgetGate(tokenId: string, barNum: number, sr: { support: number; resistance: number } | null, closes: number[]): number {
    if (!this.forgetGate.has(tokenId)) this.forgetGate.set(tokenId, []);
    const forget = this.forgetGate.get(tokenId)!;
    
    const lastEntry = this.lastEntryBar.get(tokenId) || 0;
    const barsSinceEntry = barNum - lastEntry;
    
    let forgetValue = 0.0;
    if (barsSinceEntry >= this.params.reset_bars || lastEntry === 0) {
      forgetValue = 1.0;
    } else if (barsSinceEntry > 0) {
      forgetValue = Math.exp(-this.params.entry_forget_rate * barsSinceEntry);
    } else {
      forgetValue = 0.0;
    }
    
    if (sr && closes.length > 1) {
      const prevClose = closes[closes.length - 2];
      const priceDeviation = Math.abs(closes[closes.length - 1] - sr.support) / Math.max(sr.support, 1e-9);
      if (priceDeviation < 0.01) {
        forgetValue = Math.min(1.0, forgetValue + 0.3);
      }
    }
    
    capPush(forget, forgetValue);
    return forgetValue;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const forgetGateValue = this.computeForgetGate(bar.tokenId, barNum, sr, series.closes);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const canEnter = forgetGateValue > this.params.forget_threshold;

    if (nearSupport && stochRecover && canEnter) {
      const opened = this.open(ctx, bar, barNum, this.params.risk_percent);
      if (opened) this.lastEntryBar.set(bar.tokenId, barNum);
    }
  }
}
