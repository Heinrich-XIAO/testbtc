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

export interface StratIter103AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  learning_rate: number;
  discount_factor: number;
  exploration_rate: number;
  q_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter103AStrategy extends BaseIterStrategy<StratIter103AParams> {
  private kVals: Map<string, number[]> = new Map();
  private qTable: Map<string, Map<string, number>> = new Map();
  private stateHistory: Map<string, string[]> = new Map();
  constructor(params: Partial<StratIter103AParams> = {}) {
    super('strat_iter103_a.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      learning_rate: 0.1,
      discount_factor: 0.95,
      exploration_rate: 0.1,
      q_threshold: 0.5,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private getStateKey(features: number[]): string {
    return features.map(f => f > 0.5 ? '1' : '0').join('');
  }
  private getQValue(tokenId: string, state: string): number {
    if (!this.qTable.has(tokenId)) this.qTable.set(tokenId, new Map());
    const table = this.qTable.get(tokenId)!;
    if (!table.has(state)) table.set(state, 0.5);
    return table.get(state)!;
  }
  private updateQValue(tokenId: string, state: string, reward: number): void {
    const table = this.qTable.get(tokenId)!;
    const current = table.get(state) || 0.5;
    const updated = current + this.params.learning_rate * (reward - current);
    table.set(state, updated);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.stateHistory.has(bar.tokenId)) this.stateHistory.set(bar.tokenId, []);
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
        const reward = bar.close > e ? 1 : -1;
        const history = this.stateHistory.get(bar.tokenId)!;
        for (const state of history) {
          this.updateQValue(bar.tokenId, state, reward);
        }
        history.length = 0;
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
    const state = this.getStateKey(features);
    const history = this.stateHistory.get(bar.tokenId)!;
    history.push(state);
    if (history.length > 5) history.shift();
    const qValue = this.getQValue(bar.tokenId, state);
    if (qValue >= this.params.q_threshold || Math.random() < this.params.exploration_rate) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter103BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  learning_rate: number;
  discount_factor: number;
  exploration_rate: number;
  sarsa_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter103BStrategy extends BaseIterStrategy<StratIter103BParams> {
  private kVals: Map<string, number[]> = new Map();
  private sarsaTable: Map<string, Map<string, number>> = new Map();
  private lastState: Map<string, string> = new Map();
  private lastAction: Map<string, number> = new Map();
  constructor(params: Partial<StratIter103BParams> = {}) {
    super('strat_iter103_b.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      learning_rate: 0.15,
      discount_factor: 0.9,
      exploration_rate: 0.15,
      sarsa_threshold: 0.55,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private getStateKey(features: number[]): string {
    return features.map(f => f > 0.5 ? '1' : '0').join('');
  }
  private getSarsaValue(tokenId: string, state: string): number {
    if (!this.sarsaTable.has(tokenId)) this.sarsaTable.set(tokenId, new Map());
    const table = this.sarsaTable.get(tokenId)!;
    if (!table.has(state)) table.set(state, 0.5);
    return table.get(state)!;
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
        const reward = bar.close > e ? 1 : -1;
        const lastState = this.lastState.get(bar.tokenId);
        if (lastState) {
          const table = this.sarsaTable.get(bar.tokenId)!;
          const current = table.get(lastState) || 0.5;
          const nextFeatures = [
            bar.low <= (sr?.support || 0) * 1.015 ? 1 : 0,
            kv.length > 0 && kv[kv.length - 1] < 30 ? 1 : 0
          ];
          const nextState = this.getStateKey(nextFeatures);
          const nextQ = this.getSarsaValue(bar.tokenId, nextState);
          const updated = current + this.params.learning_rate * (reward + this.params.discount_factor * nextQ - current);
          table.set(lastState, updated);
        }
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
    const state = this.getStateKey(features);
    this.lastState.set(bar.tokenId, state);
    const sarsaValue = this.getSarsaValue(bar.tokenId, state);
    if (sarsaValue >= this.params.sarsa_threshold || Math.random() < this.params.exploration_rate) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter103CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  learning_rate: number;
  baseline_decay: number;
  policy_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter103CStrategy extends BaseIterStrategy<StratIter103CParams> {
  private kVals: Map<string, number[]> = new Map();
  private policyWeights: Map<string, number[]> = new Map();
  private baseline: Map<string, number> = new Map();
  constructor(params: Partial<StratIter103CParams> = {}) {
    super('strat_iter103_c.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      learning_rate: 0.01,
      baseline_decay: 0.9,
      policy_threshold: 0.55,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }
  private getPolicyProb(weights: number[], features: number[]): number {
    let sum = 0;
    for (let i = 0; i < weights.length && i < features.length; i++) {
      sum += weights[i] * features[i];
    }
    return this.sigmoid(sum);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.policyWeights.has(bar.tokenId)) {
      this.policyWeights.set(bar.tokenId, Array(5).fill(0.1));
      this.baseline.set(bar.tokenId, 0);
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
        const reward = (bar.close - e) / e;
        const baseline = this.baseline.get(bar.tokenId)!;
        const advantage = reward - baseline;
        this.baseline.set(bar.tokenId, baseline * this.params.baseline_decay + reward * (1 - this.params.baseline_decay));
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
    const weights = this.policyWeights.get(bar.tokenId)!;
    const prob = this.getPolicyProb(weights, features);
    if (prob >= this.params.policy_threshold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter103DParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  actor_lr: number;
  critic_lr: number;
  discount_factor: number;
  actor_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter103DStrategy extends BaseIterStrategy<StratIter103DParams> {
  private kVals: Map<string, number[]> = new Map();
  private actorWeights: Map<string, number[]> = new Map();
  private criticWeights: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter103DParams> = {}) {
    super('strat_iter103_d.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      actor_lr: 0.01,
      critic_lr: 0.05,
      discount_factor: 0.95,
      actor_threshold: 0.5,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }
  private getActorProb(weights: number[], features: number[]): number {
    let sum = 0;
    for (let i = 0; i < weights.length && i < features.length; i++) {
      sum += weights[i] * features[i];
    }
    return this.sigmoid(sum);
  }
  private getCriticValue(weights: number[], features: number[]): number {
    let sum = 0;
    for (let i = 0; i < weights.length && i < features.length; i++) {
      sum += weights[i] * features[i];
    }
    return sum;
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.actorWeights.has(bar.tokenId)) {
      this.actorWeights.set(bar.tokenId, Array(5).fill(0.1));
      this.criticWeights.set(bar.tokenId, Array(5).fill(0.1));
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
        const reward = (bar.close - e) / e;
        const features: number[] = [
          bar.low <= (sr?.support || 0) * 1.015 ? 1 : 0,
          kv.length > 0 && kv[kv.length - 1] < 30 ? 1 : 0,
          kv.length > 1 && kv[kv.length - 1] > kv[kv.length - 2] ? 1 : 0,
          series.closes.length > 1 && bar.close > series.closes[series.closes.length - 2] ? 1 : 0,
          bar.close > (bar.high + bar.low) / 2 ? 1 : 0
        ];
        const actorW = this.actorWeights.get(bar.tokenId)!;
        const criticW = this.criticWeights.get(bar.tokenId)!;
        const value = this.getCriticValue(criticW, features);
        const tdError = reward - value;
        for (let i = 0; i < criticW.length; i++) {
          criticW[i] += this.params.critic_lr * tdError * features[i];
        }
        for (let i = 0; i < actorW.length; i++) {
          actorW[i] += this.params.actor_lr * tdError * features[i];
        }
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
    const actorW = this.actorWeights.get(bar.tokenId)!;
    const prob = this.getActorProb(actorW, features);
    if (prob >= this.params.actor_threshold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter103EParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  num_arms: number;
  exploration_bonus: number;
  confidence_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter103EStrategy extends BaseIterStrategy<StratIter103EParams> {
  private kVals: Map<string, number[]> = new Map();
  private armCounts: Map<string, number[]> = new Map();
  private armRewards: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter103EParams> = {}) {
    super('strat_iter103_e.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      num_arms: 5,
      exploration_bonus: 2.0,
      confidence_threshold: 0.6,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private selectArm(counts: number[], rewards: number[], c: number): number {
    let bestArm = 0;
    let bestScore = -Infinity;
    const total = counts.reduce((s, c) => s + c, 0);
    for (let i = 0; i < counts.length; i++) {
      const avgReward = counts[i] > 0 ? rewards[i] / counts[i] : 0;
      const exploration = counts[i] > 0 ? c * Math.sqrt(Math.log(total + 1) / counts[i]) : c;
      const score = avgReward + exploration;
      if (score > bestScore) {
        bestScore = score;
        bestArm = i;
      }
    }
    return bestArm;
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.armCounts.has(bar.tokenId)) {
      this.armCounts.set(bar.tokenId, Array(this.params.num_arms).fill(0));
      this.armRewards.set(bar.tokenId, Array(this.params.num_arms).fill(0));
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
        const reward = bar.close > e ? 1 : 0;
        const counts = this.armCounts.get(bar.tokenId)!;
        const rewards = this.armRewards.get(bar.tokenId)!;
        const arm = Math.floor(Math.random() * this.params.num_arms);
        counts[arm]++;
        rewards[arm] += reward;
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const counts = this.armCounts.get(bar.tokenId)!;
    const rewards = this.armRewards.get(bar.tokenId)!;
    const selectedArm = this.selectArm(counts, rewards, this.params.exploration_bonus);
    const total = counts.reduce((s, c) => s + c, 0);
    const avgReward = total > 0 ? rewards.reduce((s, r) => s + r, 0) / total : 0;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (avgReward >= this.params.confidence_threshold && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
