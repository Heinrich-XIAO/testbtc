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

export interface StratIter105AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  return_weight: number;
  drawdown_weight: number;
  trade_weight: number;
  pareto_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter105AStrategy extends BaseIterStrategy<StratIter105AParams> {
  private kVals: Map<string, number[]> = new Map();
  private returns: Map<string, number[]> = new Map();
  private drawdowns: Map<string, number[]> = new Map();
  private tradeCounts: Map<string, number[]> = new Map();
  private paretoFront: Map<string, { return: number; drawdown: number; trades: number }> = new Map();
  constructor(params: Partial<StratIter105AParams> = {}) {
    super('strat_iter105_a.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      return_weight: 0.4,
      drawdown_weight: 0.3,
      trade_weight: 0.3,
      pareto_threshold: 0.5,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private updateParetoFront(tokenId: string, ret: number, dd: number, trades: number): void {
    const current = this.paretoFront.get(tokenId);
    if (!current) {
      this.paretoFront.set(tokenId, { return: ret, drawdown: dd, trades });
      return;
    }
    const dominates = ret >= current.return && dd <= current.drawdown && trades >= current.trades;
    const dominated = ret <= current.return && dd >= current.drawdown && trades <= current.trades;
    if (dominates && !dominated) {
      this.paretoFront.set(tokenId, { return: ret, drawdown: dd, trades });
    }
  }
  private getParetoScore(tokenId: string): number {
    const p = this.paretoFront.get(tokenId);
    if (!p) return 0.5;
    return this.params.return_weight * Math.max(0, p.return) + this.params.drawdown_weight * Math.max(0, 1 - p.drawdown) + this.params.trade_weight * Math.min(1, p.trades / 20);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.returns.has(bar.tokenId)) {
      this.returns.set(bar.tokenId, []);
      this.drawdowns.set(bar.tokenId, []);
      this.tradeCounts.set(bar.tokenId, []);
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
        const ret = (bar.close - e) / e;
        const dd = Math.min(1, Math.max(0, (e - bar.low) / e));
        const returns = this.returns.get(bar.tokenId)!;
        const drawdowns = this.drawdowns.get(bar.tokenId)!;
        capPush(returns, ret);
        capPush(drawdowns, dd);
        const avgRet = mean(returns);
        const avgDd = mean(drawdowns);
        this.updateParetoFront(bar.tokenId, avgRet, avgDd, returns.length);
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const paretoScore = this.getParetoScore(bar.tokenId);
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (paretoScore >= this.params.pareto_threshold && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter105BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  penalty_weight: number;
  feasibility_threshold: number;
  constraint_tolerance: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter105BStrategy extends BaseIterStrategy<StratIter105BParams> {
  private kVals: Map<string, number[]> = new Map();
  private constraintViolations: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter105BParams> = {}) {
    super('strat_iter105_b.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      penalty_weight: 0.5,
      feasibility_threshold: 0.6,
      constraint_tolerance: 0.1,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private computeFeasibility(violations: number[]): number {
    if (violations.length === 0) return 1;
    const avgViolation = mean(violations);
    return Math.max(0, 1 - avgViolation * this.params.penalty_weight);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.constraintViolations.has(bar.tokenId)) this.constraintViolations.set(bar.tokenId, []);
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
        const ret = (bar.close - e) / e;
        const violation = ret < -this.params.constraint_tolerance ? 1 : 0;
        const violations = this.constraintViolations.get(bar.tokenId)!;
        capPush(violations, violation);
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const violations = this.constraintViolations.get(bar.tokenId)!;
    const feasibility = this.computeFeasibility(violations);
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (feasibility >= this.params.feasibility_threshold && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter105CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  surrogate_window: number;
  model_confidence: number;
  prediction_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter105CStrategy extends BaseIterStrategy<StratIter105CParams> {
  private kVals: Map<string, number[]> = new Map();
  private surrogateModel: Map<string, { intercept: number; coefficients: number[] }> = new Map();
  private trainingData: Map<string, { x: number[][]; y: number[] }> = new Map();
  constructor(params: Partial<StratIter105CParams> = {}) {
    super('strat_iter105_c.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      surrogate_window: 15,
      model_confidence: 0.6,
      prediction_threshold: 0.55,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private fitLinearModel(x: number[][], y: number[]): { intercept: number; coefficients: number[] } {
    const n = x.length;
    const d = x[0]?.length || 0;
    if (n < 2 || d === 0) return { intercept: 0.5, coefficients: Array(d).fill(0) };
    const meanX: number[] = Array(d).fill(0);
    for (let j = 0; j < d; j++) {
      for (let i = 0; i < n; i++) meanX[j] += x[i][j];
      meanX[j] /= n;
    }
    const meanY = mean(y);
    let intercept = meanY;
    const coefficients: number[] = Array(d).fill(0);
    for (let j = 0; j < d; j++) {
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (x[i][j] - meanX[j]) * (y[i] - meanY);
        den += Math.pow(x[i][j] - meanX[j], 2);
      }
      coefficients[j] = den > 1e-6 ? num / den : 0;
    }
    return { intercept, coefficients };
  }
  private predict(model: { intercept: number; coefficients: number[] }, x: number[]): number {
    let sum = model.intercept;
    for (let i = 0; i < model.coefficients.length && i < x.length; i++) {
      sum += model.coefficients[i] * x[i];
    }
    return Math.max(0, Math.min(1, sum));
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.trainingData.has(bar.tokenId)) {
      this.trainingData.set(bar.tokenId, { x: [], y: [] });
      this.surrogateModel.set(bar.tokenId, { intercept: 0.5, coefficients: [0.1, 0.1, 0.1, 0.1, 0.1] });
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
        const y = bar.close > e ? 1 : 0;
        const features = [
          bar.low <= (sr?.support || 0) * 1.015 ? 1 : 0,
          kv.length > 0 ? kv[kv.length - 1] / 100 : 0.5,
          series.closes.length > 1 && bar.close > series.closes[series.closes.length - 2] ? 1 : 0,
          bar.close > (bar.high + bar.low) / 2 ? 1 : 0,
          kv.length > 1 && kv[kv.length - 1] > kv[kv.length - 2] ? 1 : 0
        ];
        const data = this.trainingData.get(bar.tokenId)!;
        data.x.push(features);
        data.y.push(y);
        if (data.x.length > this.params.surrogate_window) {
          data.x.shift();
          data.y.shift();
        }
        if (data.x.length >= 5) {
          this.surrogateModel.set(bar.tokenId, this.fitLinearModel(data.x, data.y));
        }
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const features: number[] = [
      bar.low <= sr.support * 1.015 ? 1 : 0,
      kv[kv.length - 1] / 100,
      series.closes.length > 1 && bar.close > series.closes[series.closes.length - 2] ? 1 : 0,
      bar.close > (bar.high + bar.low) / 2 ? 1 : 0,
      kv[kv.length - 1] > kv[kv.length - 2] ? 1 : 0
    ];
    const model = this.surrogateModel.get(bar.tokenId)!;
    const prediction = this.predict(model, features);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (prediction >= this.params.prediction_threshold && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter105DParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  search_method: string;
  grid_granularity: number;
  score_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter105DStrategy extends BaseIterStrategy<StratIter105DParams> {
  private kVals: Map<string, number[]> = new Map();
  private hyperparams: Map<string, { lookback: number; threshold: number }> = new Map();
  private performance: Map<string, { returns: number[]; bestLookback: number; bestThreshold: number }> = new Map();
  constructor(params: Partial<StratIter105DParams> = {}) {
    super('strat_iter105_d.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      search_method: 'random',
      grid_granularity: 5,
      score_threshold: 0.5,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private tuneHyperparams(tokenId: string): void {
    const perf = this.performance.get(tokenId);
    if (!perf || perf.returns.length < 3) return;
    const avgReturn = mean(perf.returns);
    if (avgReturn > 0) {
      perf.bestLookback = Math.min(50, perf.bestLookback + 5);
    } else {
      perf.bestLookback = Math.max(10, perf.bestLookback - 5);
    }
    perf.bestThreshold = Math.max(0.3, Math.min(0.9, perf.bestThreshold + (Math.random() - 0.5) * 0.1));
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.performance.has(bar.tokenId)) {
      this.performance.set(bar.tokenId, { returns: [], bestLookback: 30, bestThreshold: 0.5 });
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
        const ret = (bar.close - e) / e;
        const perf = this.performance.get(bar.tokenId)!;
        perf.returns.push(ret);
        if (perf.returns.length > 10) perf.returns.shift();
        this.tuneHyperparams(bar.tokenId);
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const perf = this.performance.get(bar.tokenId)!;
    const dynamicLookback = Math.min(series.closes.length - 1, perf.bestLookback);
    const dynamicSupport = dynamicLookback > 0 ? Math.min(...series.lows.slice(-dynamicLookback)) : sr.support;
    const nearSupport = bar.low <= dynamicSupport * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const stochSignal = kv[kv.length - 1] / 100 >= perf.bestThreshold;
    if (nearSupport && stochRecover && stochSignal) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter105EParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  meta_learning_rate: number;
  adaptation_window: number;
  meta_score_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter105EStrategy extends BaseIterStrategy<StratIter105EParams> {
  private kVals: Map<string, number[]> = new Map();
  private baseWeights: Map<string, number[]> = new Map();
  private adaptedWeights: Map<string, number[]> = new Map();
  private taskPerformance: Map<string, { returns: number[]; lastAdaptation: number }> = new Map();
  constructor(params: Partial<StratIter105EParams> = {}) {
    super('strat_iter105_e.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      meta_learning_rate: 0.1,
      adaptation_window: 5,
      meta_score_threshold: 0.55,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private metaUpdate(tokenId: string, gradient: number[]): void {
    const base = this.baseWeights.get(tokenId) || Array(5).fill(0.2);
    const adapted = this.adaptedWeights.get(tokenId) || [...base];
    for (let i = 0; i < base.length; i++) {
      base[i] += this.params.meta_learning_rate * (adapted[i] - base[i]) * gradient[i];
      base[i] = Math.max(0, Math.min(1, base[i]));
    }
    this.baseWeights.set(tokenId, base);
  }
  private adapt(tokenId: string, features: number[]): number[] {
    const base = this.baseWeights.get(tokenId) || Array(5).fill(0.2);
    const adapted = [...base];
    for (let i = 0; i < adapted.length; i++) {
      adapted[i] += features[i] * 0.1;
      adapted[i] = Math.max(0, Math.min(1, adapted[i]));
    }
    this.adaptedWeights.set(tokenId, adapted);
    return adapted;
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.baseWeights.has(bar.tokenId)) {
      this.baseWeights.set(bar.tokenId, Array(5).fill(0.2));
      this.taskPerformance.set(bar.tokenId, { returns: [], lastAdaptation: 0 });
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
        const ret = (bar.close - e) / e;
        const perf = this.taskPerformance.get(bar.tokenId)!;
        perf.returns.push(ret);
        if (perf.returns.length > this.params.adaptation_window) perf.returns.shift();
        const avgReturn = mean(perf.returns);
        const gradient = this.adaptedWeights.get(bar.tokenId) || Array(5).fill(0.2);
        const scaledGradient = gradient.map(g => g * (avgReturn > 0 ? 1 : -1) * Math.abs(avgReturn));
        this.metaUpdate(bar.tokenId, scaledGradient);
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const features: number[] = [
      bar.low <= sr.support * 1.015 ? 1 : 0,
      kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold ? 1 : 0,
      kv[kv.length - 1] < 30 ? 1 : 0,
      series.closes.length > 1 && bar.close > series.closes[series.closes.length - 2] ? 1 : 0,
      bar.close > (bar.high + bar.low) / 2 ? 1 : 0
    ];
    const adapted = this.adapt(bar.tokenId, features);
    let score = 0;
    for (let i = 0; i < features.length; i++) {
      score += features[i] * adapted[i];
    }
    score /= features.length;
    if (score >= this.params.meta_score_threshold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
