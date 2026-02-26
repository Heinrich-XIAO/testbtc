import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

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

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((s, x) => s + (x - m) * (x - m), 0) / values.length;
  return Math.sqrt(v);
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
  protected series: Map<string, { closes: number[]; highs: number[]; lows: number[] }> = new Map();
  protected bars: Map<string, number> = new Map();
  protected entryPrice: Map<string, number> = new Map();
  protected entryBar: Map<string, number> = new Map();

  constructor(fileName: string, defaults: P, params: Partial<P>) {
    const saved = loadSavedParams<P>(fileName);
    this.params = { ...defaults, ...saved, ...params } as P;
  }

  onInit(_ctx: BacktestContext): void {}

  protected nextBar(bar: Bar): { series: { closes: number[]; highs: number[]; lows: number[] }; barNum: number } {
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

export interface StratIter104AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  prior_alpha: number;
  prior_beta: number;
  update_strength: number;
  posterior_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter104AStrategy extends BaseIterStrategy<StratIter104AParams> {
  private kVals: Map<string, number[]> = new Map();
  private alpha: Map<string, number> = new Map();
  private beta: Map<string, number> = new Map();
  constructor(params: Partial<StratIter104AParams> = {}) {
    super('strat_iter104_a.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      prior_alpha: 2,
      prior_beta: 2,
      update_strength: 1,
      posterior_threshold: 0.55,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private getPosteriorMean(tokenId: string): number {
    const a = this.alpha.get(tokenId) || this.params.prior_alpha;
    const b = this.beta.get(tokenId) || this.params.prior_beta;
    return a / (a + b);
  }
  private updatePosterior(tokenId: string, success: boolean): void {
    const a = this.alpha.get(tokenId) || this.params.prior_alpha;
    const b = this.beta.get(tokenId) || this.params.prior_beta;
    this.alpha.set(tokenId, a + (success ? this.params.update_strength : 0));
    this.beta.set(tokenId, b + (success ? 0 : this.params.update_strength));
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.alpha.has(bar.tokenId)) {
      this.alpha.set(bar.tokenId, this.params.prior_alpha);
      this.beta.set(bar.tokenId, this.params.prior_beta);
    }
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        const success = bar.close > e;
        this.updatePosterior(bar.tokenId, success);
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const posteriorMean = this.getPosteriorMean(bar.tokenId);
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (posteriorMean >= this.params.posterior_threshold && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter104BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  num_samples: number;
  sample_threshold: number;
  confidence_level: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter104BStrategy extends BaseIterStrategy<StratIter104BParams> {
  private kVals: Map<string, number[]> = new Map();
  private samples: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter104BParams> = {}) {
    super('strat_iter104_b.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      num_samples: 20,
      sample_threshold: 0.55,
      confidence_level: 0.6,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private samplePosterior(tokenId: string): number {
    const samples = this.samples.get(tokenId) || [];
    if (samples.length === 0) return 0.5;
    return samples[Math.floor(Math.random() * samples.length)];
  }
  private addSample(tokenId: string, value: number): void {
    if (!this.samples.has(tokenId)) this.samples.set(tokenId, []);
    const samples = this.samples.get(tokenId)!;
    samples.push(value);
    if (samples.length > this.params.num_samples) samples.shift();
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        const value = bar.close > e ? 1 : 0;
        this.addSample(bar.tokenId, value);
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    let sampleSum = 0;
    for (let i = 0; i < 3; i++) {
      sampleSum += this.samplePosterior(bar.tokenId);
    }
    const avgSample = sampleSum / 3;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (avgSample >= this.params.sample_threshold && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter104CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  alpha: number;
  beta: number;
  thompson_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter104CStrategy extends BaseIterStrategy<StratIter104CParams> {
  private kVals: Map<string, number[]> = new Map();
  private successCount: Map<string, number> = new Map();
  private failCount: Map<string, number> = new Map();
  constructor(params: Partial<StratIter104CParams> = {}) {
    super('strat_iter104_c.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      alpha: 1,
      beta: 1,
      thompson_threshold: 0.5,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private sampleBeta(tokenId: string): number {
    const a = (this.successCount.get(tokenId) || 0) + this.params.alpha;
    const b = (this.failCount.get(tokenId) || 0) + this.params.beta;
    const u1 = Math.random();
    const u2 = Math.random();
    const x = Math.pow(u1, 1 / a);
    const y = Math.pow(u2, 1 / b);
    return x / (x + y);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.successCount.has(bar.tokenId)) {
      this.successCount.set(bar.tokenId, 0);
      this.failCount.set(bar.tokenId, 0);
    }
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        const success = bar.close > e;
        if (success) {
          this.successCount.set(bar.tokenId, (this.successCount.get(bar.tokenId) || 0) + 1);
        } else {
          this.failCount.set(bar.tokenId, (this.failCount.get(bar.tokenId) || 0) + 1);
        }
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const thompsonSample = this.sampleBeta(bar.tokenId);
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (thompsonSample >= this.params.thompson_threshold && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter104DParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  acquisition_type: string;
  exploration_weight: number;
  best_score_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter104DStrategy extends BaseIterStrategy<StratIter104DParams> {
  private kVals: Map<string, number[]> = new Map();
  private paramCandidates: Map<string, number[]> = new Map();
  private paramScores: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter104DParams> = {}) {
    super('strat_iter104_d.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      acquisition_type: 'ucb',
      exploration_weight: 2.0,
      best_score_threshold: 0.5,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private ucb(mean: number, n: number, total: number, c: number): number {
    if (n === 0) return Infinity;
    return mean + c * Math.sqrt(Math.log(total + 1) / n);
  }
  private selectBestParam(tokenId: string): number {
    const candidates = this.paramCandidates.get(tokenId) || [0.5];
    const scores = this.paramScores.get(tokenId) || [];
    const counts = scores.map(s => 1);
    const total = counts.reduce((a, b) => a + b, 0);
    let bestIdx = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const mean = scores[i] || 0.5;
      const value = this.ucb(mean, counts[i] || 0, total, this.params.exploration_weight);
      if (value > bestValue) {
        bestValue = value;
        bestIdx = i;
      }
    }
    return candidates[bestIdx];
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.paramCandidates.has(bar.tokenId)) {
      this.paramCandidates.set(bar.tokenId, [0.3, 0.4, 0.5, 0.6, 0.7]);
      this.paramScores.set(bar.tokenId, [0.5, 0.5, 0.5, 0.5, 0.5]);
    }
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const bestParam = this.selectBestParam(bar.tokenId);
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (bestParam >= this.params.best_score_threshold && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter104EParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  kernel_type: string;
  length_scale: number;
  noise_variance: number;
  prediction_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter104EStrategy extends BaseIterStrategy<StratIter104EParams> {
  private kVals: Map<string, number[]> = new Map();
  private trainX: Map<string, number[][]> = new Map();
  private trainY: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter104EParams> = {}) {
    super('strat_iter104_e.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      kernel_type: 'rbf',
      length_scale: 1.0,
      noise_variance: 0.1,
      prediction_threshold: 0.52,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private rbfKernel(x1: number[], x2: number[], l: number): number {
    let sum = 0;
    for (let i = 0; i < x1.length && i < x2.length; i++) {
      sum += Math.pow(x1[i] - x2[i], 2);
    }
    return Math.exp(-sum / (2 * l * l));
  }
  private predict(tokenId: string, x: number[]): { mean: number; variance: number } {
    const trainX = this.trainX.get(tokenId) || [];
    const trainY = this.trainY.get(tokenId) || [];
    if (trainX.length === 0) return { mean: 0.5, variance: 1 };
    const k: number[] = trainX.map(tx => this.rbfKernel(x, tx, this.params.length_scale));
    const kSum = k.reduce((a, b) => a + b, 0);
    const mean = k.reduce((a, ki, i) => a + ki * trainY[i], 0) / Math.max(kSum, 1e-6);
    const variance = Math.max(0, 1 - k.reduce((a, ki) => a + ki * ki, 0) / Math.max(trainX.length, 1));
    return { mean, variance };
  }
  private addTrainingPoint(tokenId: string, x: number[], y: number): void {
    if (!this.trainX.has(tokenId)) {
      this.trainX.set(tokenId, []);
      this.trainY.set(tokenId, []);
    }
    const trainX = this.trainX.get(tokenId)!;
    const trainY = this.trainY.get(tokenId)!;
    trainX.push(x);
    trainY.push(y);
    if (trainX.length > 20) {
      trainX.shift();
      trainY.shift();
    }
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        const y = bar.close > e ? 1 : 0;
        const features = [
          bar.low <= (sr?.support || 0) * 1.015 ? 1 : 0,
          kv.length > 0 ? kv[kv.length - 1] / 100 : 0.5
        ];
        this.addTrainingPoint(bar.tokenId, features, y);
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const features: number[] = [
      bar.low <= sr.support * 1.015 ? 1 : 0,
      kv[kv.length - 1] / 100
    ];
    const { mean: prediction } = this.predict(bar.tokenId, features);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (prediction >= this.params.prediction_threshold && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
