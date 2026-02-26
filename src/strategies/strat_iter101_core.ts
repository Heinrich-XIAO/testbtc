import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: [];
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

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
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

export interface StratIter101AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  pattern_memory: number;
  learning_rate: number;
  activation_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter101AStrategy extends BaseIterStrategy<StratIter101AParams> {
  private kVals: Map<string, number[]> = new Map();
  private hebbianWeights: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter101AParams> = {}) {
    super('strat_iter101_a.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      pattern_memory: 20,
      learning_rate: 0.1,
      activation_threshold: 0.6,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.hebbianWeights.has(bar.tokenId)) this.hebbianWeights.set(bar.tokenId, Array(5).fill(0.5));
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
        const outcome = bar.close > e ? 1 : -1;
        const weights = this.hebbianWeights.get(bar.tokenId)!;
        for (let i = 0; i < weights.length; i++) {
          weights[i] += this.params.learning_rate * outcome * 0.1;
          weights[i] = Math.max(0, Math.min(1, weights[i]));
        }
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close) || series.closes.length < this.params.pattern_memory) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const recentReturns: number[] = [];
    for (let i = Math.max(1, series.closes.length - 5); i < series.closes.length; i++) {
      recentReturns.push((series.closes[i] - series.closes[i - 1]) / series.closes[i - 1]);
    }
    const patternVector = [
      nearSupport ? 1 : 0,
      stochRecover ? 1 : 0,
      kv[kv.length - 1] < 30 ? 1 : 0,
      recentReturns.length > 0 && mean(recentReturns) > 0 ? 1 : 0,
      bar.close > series.closes[series.closes.length - 2] ? 1 : 0
    ];
    const weights = this.hebbianWeights.get(bar.tokenId)!;
    let activation = 0;
    for (let i = 0; i < patternVector.length; i++) {
      activation += patternVector[i] * weights[i];
    }
    activation /= patternVector.length;
    if (activation >= this.params.activation_threshold) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIter101BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  competition_window: number;
  winner_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter101BStrategy extends BaseIterStrategy<StratIter101BParams> {
  private kVals: Map<string, number[]> = new Map();
  private competitorScores: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter101BParams> = {}) {
    super('strat_iter101_b.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      competition_window: 10,
      winner_threshold: 0.7,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.competitorScores.has(bar.tokenId)) this.competitorScores.set(bar.tokenId, []);
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
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close) || series.closes.length < this.params.competition_window + 1) return;
    const signals: number[] = [];
    const nearSupport = bar.low <= sr.support * 1.015 ? 1 : 0;
    signals.push(nearSupport);
    const stochOversold = kv[kv.length - 1] < this.params.stoch_oversold ? 1 : 0;
    signals.push(stochOversold);
    const momentum = series.closes.length > 3 ? (bar.close - series.closes[series.closes.length - 4]) / series.closes[series.closes.length - 4] : 0;
    signals.push(momentum > 0 ? 1 : 0);
    const aboveMid = bar.close > (bar.high + bar.low) / 2 ? 1 : 0;
    signals.push(aboveMid);
    const recentVol = series.closes.length >= this.params.competition_window ? stddev(series.closes.slice(-this.params.competition_window)) : 0;
    signals.push(recentVol < stddev(series.closes.slice(-Math.min(series.closes.length, 20))) ? 1 : 0);
    const winnerScore = Math.max(...signals);
    const avgScore = mean(signals);
    const scores = this.competitorScores.get(bar.tokenId)!;
    capPush(scores, avgScore);
    if (scores.length < 3) return;
    const recentAvg = mean(scores.slice(-3));
    if (winnerScore >= this.params.winner_threshold && recentAvg > 0.5) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter101CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  pattern_length: number;
  similarity_threshold: number;
  energy_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter101CStrategy extends BaseIterStrategy<StratIter101CParams> {
  private kVals: Map<string, number[]> = new Map();
  private patternMemory: Map<string, number[][]> = new Map();
  constructor(params: Partial<StratIter101CParams> = {}) {
    super('strat_iter101_c.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      pattern_length: 5,
      similarity_threshold: 0.8,
      energy_threshold: 0.5,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private normalizePattern(prices: number[]): number[] {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (max === min) return prices.map(() => 0.5);
    return prices.map(p => (p - min) / (max - min));
  }
  private patternSimilarity(p1: number[], p2: number[]): number {
    if (p1.length !== p2.length) return 0;
    let sum = 0;
    for (let i = 0; i < p1.length; i++) {
      sum += 1 - Math.abs(p1[i] - p2[i]);
    }
    return sum / p1.length;
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.patternMemory.has(bar.tokenId)) this.patternMemory.set(bar.tokenId, []);
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
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close) || series.closes.length < this.params.pattern_length + 1) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (!nearSupport || !stochRecover) return;
    const currentPattern = this.normalizePattern(series.closes.slice(-this.params.pattern_length));
    const patterns = this.patternMemory.get(bar.tokenId)!;
    let bestMatch = 0;
    for (const storedPattern of patterns) {
      const sim = this.patternSimilarity(currentPattern, storedPattern);
      bestMatch = Math.max(bestMatch, sim);
    }
    let energy = 0;
    for (let i = 0; i < currentPattern.length; i++) {
      energy += currentPattern[i] * currentPattern[i];
    }
    energy = Math.sqrt(energy / currentPattern.length);
    if (bestMatch >= this.params.similarity_threshold || energy >= this.params.energy_threshold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
    if (patterns.length > 50) patterns.shift();
    patterns.push(currentPattern);
  }
}

export interface StratIter101DParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  hidden_units: number;
  temperature: number;
  energy_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter101DStrategy extends BaseIterStrategy<StratIter101DParams> {
  private kVals: Map<string, number[]> = new Map();
  private visibleState: Map<string, number[]> = new Map();
  private weights: Map<string, number[][]> = new Map();
  constructor(params: Partial<StratIter101DParams> = {}) {
    super('strat_iter101_d.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      hidden_units: 4,
      temperature: 1.0,
      energy_threshold: -0.5,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }
  private computeEnergy(visible: number[], hidden: number[], weights: number[][]): number {
    let energy = 0;
    for (let i = 0; i < visible.length; i++) {
      for (let j = 0; j < hidden.length; j++) {
        energy -= weights[i][j] * visible[i] * hidden[j];
      }
    }
    return energy;
  }
  private sampleHidden(visible: number[], weights: number[][], temperature: number): number[] {
    const hidden: number[] = [];
    for (let j = 0; j < weights[0].length; j++) {
      let sum = 0;
      for (let i = 0; i < visible.length; i++) {
        sum += weights[i][j] * visible[i];
      }
      const prob = this.sigmoid(sum / temperature);
      hidden.push(Math.random() < prob ? 1 : 0);
    }
    return hidden;
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
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 1 || shouldSkipPrice(bar.close)) return;
    const visible: number[] = [
      bar.low <= sr.support * 1.015 ? 1 : 0,
      kv[kv.length - 1] < this.params.stoch_oversold ? 1 : 0,
      kv[kv.length - 1] >= this.params.stoch_oversold && kv.length >= 2 && kv[kv.length - 2] < this.params.stoch_oversold ? 1 : 0,
      bar.close > (bar.high + bar.low) / 2 ? 1 : 0,
      series.closes.length > 1 && bar.close > series.closes[series.closes.length - 2] ? 1 : 0
    ];
    if (!this.weights.has(bar.tokenId)) {
      const w: number[][] = [];
      for (let i = 0; i < visible.length; i++) {
        w.push([]);
        for (let j = 0; j < this.params.hidden_units; j++) {
          w[i].push((Math.random() - 0.5) * 0.1);
        }
      }
      this.weights.set(bar.tokenId, w);
    }
    const weights = this.weights.get(bar.tokenId)!;
    const hidden = this.sampleHidden(visible, weights, this.params.temperature);
    const energy = this.computeEnergy(visible, hidden, weights);
    if (energy < this.params.energy_threshold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter101EParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  cd_steps: number;
  learning_rate: number;
  score_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter101EStrategy extends BaseIterStrategy<StratIter101EParams> {
  private kVals: Map<string, number[]> = new Map();
  private weights: Map<string, number[]> = new Map();
  private visibleBias: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter101EParams> = {}) {
    super('strat_iter101_e.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      cd_steps: 2,
      learning_rate: 0.05,
      score_threshold: 0.65,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }
  private sampleFromProb(probs: number[]): number[] {
    return probs.map(p => Math.random() < p ? 1 : 0);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.weights.has(bar.tokenId)) this.weights.set(bar.tokenId, Array(6).fill(0.1));
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
        const outcome = bar.close > e ? 1 : 0;
        const weights = this.weights.get(bar.tokenId)!;
        const gradient = outcome === 1 ? 0.1 : -0.05;
        for (let i = 0; i < weights.length; i++) {
          weights[i] += this.params.learning_rate * gradient;
        }
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const momentum = series.closes.length > 2 ? (bar.close - series.closes[series.closes.length - 3]) / Math.max(series.closes[series.closes.length - 3], 1e-9) : 0;
    const visible: number[] = [
      nearSupport ? 1 : 0,
      stochRecover ? 1 : 0,
      kv[kv.length - 1] < 30 ? 1 : 0,
      momentum > 0.005 ? 1 : 0,
      bar.close > (bar.high + bar.low) / 2 ? 1 : 0,
      bar.close > series.closes[series.closes.length - 2] ? 1 : 0
    ];
    const weights = this.weights.get(bar.tokenId)!;
    let score = 0;
    for (let i = 0; i < visible.length; i++) {
      score += visible[i] * weights[i];
    }
    score = this.sigmoid(score);
    if (score >= this.params.score_threshold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
