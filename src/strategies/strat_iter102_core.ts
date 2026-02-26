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

export interface StratIter102AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  population_size: number;
  mutation_rate: number;
  crossover_rate: number;
  fitness_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter102AStrategy extends BaseIterStrategy<StratIter102AParams> {
  private kVals: Map<string, number[]> = new Map();
  private population: Map<string, number[][]> = new Map();
  private generation: Map<string, number> = new Map();
  constructor(params: Partial<StratIter102AParams> = {}) {
    super('strat_iter102_a.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      population_size: 10,
      mutation_rate: 0.1,
      crossover_rate: 0.7,
      fitness_threshold: 0.6,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private initPopulation(size: number, geneLength: number): number[][] {
    const pop: number[][] = [];
    for (let i = 0; i < size; i++) {
      pop.push(Array(geneLength).fill(0).map(() => Math.random()));
    }
    return pop;
  }
  private evaluateFitness(genes: number[], features: number[]): number {
    let fitness = 0;
    for (let i = 0; i < genes.length && i < features.length; i++) {
      fitness += genes[i] * features[i];
    }
    return fitness / genes.length;
  }
  private crossover(parent1: number[], parent2: number[]): number[] {
    if (Math.random() > this.params.crossover_rate) return [...parent1];
    const point = Math.floor(Math.random() * parent1.length);
    return [...parent1.slice(0, point), ...parent2.slice(point)];
  }
  private mutate(genes: number[]): number[] {
    return genes.map(g => Math.random() < this.params.mutation_rate ? Math.random() : g);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.population.has(bar.tokenId)) {
      this.population.set(bar.tokenId, this.initPopulation(this.params.population_size, 5));
      this.generation.set(bar.tokenId, 0);
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
        const fitness = bar.close > e ? 1 : 0;
        const pop = this.population.get(bar.tokenId)!;
        const sorted = pop.sort((a, b) => this.evaluateFitness(b, [fitness, fitness, fitness, fitness, fitness]) - this.evaluateFitness(a, [fitness, fitness, fitness, fitness, fitness]));
        const newPop: number[][] = [sorted[0], sorted[1]];
        while (newPop.length < this.params.population_size) {
          const p1 = sorted[Math.floor(Math.random() * 2)];
          const p2 = sorted[Math.floor(Math.random() * 2)];
          newPop.push(this.mutate(this.crossover(p1, p2)));
        }
        this.population.set(bar.tokenId, newPop);
        this.generation.set(bar.tokenId, (this.generation.get(bar.tokenId) || 0) + 1);
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
    const pop = this.population.get(bar.tokenId)!;
    let bestFitness = 0;
    let bestGenes = pop[0];
    for (const genes of pop) {
      const fit = this.evaluateFitness(genes, features);
      if (fit > bestFitness) {
        bestFitness = fit;
        bestGenes = genes;
      }
    }
    if (bestFitness >= this.params.fitness_threshold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter102BParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  tree_depth: number;
  mutation_prob: number;
  score_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter102BStrategy extends BaseIterStrategy<StratIter102BParams> {
  private kVals: Map<string, number[]> = new Map();
  private ruleTree: Map<string, { threshold: number; left: number; right: number }> = new Map();
  constructor(params: Partial<StratIter102BParams> = {}) {
    super('strat_iter102_b.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      tree_depth: 3,
      mutation_prob: 0.15,
      score_threshold: 0.7,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private evaluateTree(node: { threshold: number; left: number; right: number }, value: number): number {
    return value < node.threshold ? node.left : node.right;
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.ruleTree.has(bar.tokenId)) {
      this.ruleTree.set(bar.tokenId, { threshold: 0.5, left: 0.7, right: 0.3 });
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
        const outcome = bar.close > e ? 1 : 0;
        const node = this.ruleTree.get(bar.tokenId)!;
        if (Math.random() < this.params.mutation_prob) {
          node.threshold += (outcome - 0.5) * 0.1;
          node.threshold = Math.max(0, Math.min(1, node.threshold));
          node.left += (outcome - 0.5) * 0.05;
          node.right += (outcome - 0.5) * 0.05;
        }
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    if (!sr || kv.length < 2 || shouldSkipPrice(bar.close)) return;
    const nearSupport = bar.low <= sr.support * 1.015 ? 1 : 0;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold ? 1 : 0;
    const momentum = series.closes.length > 2 ? (bar.close - series.closes[series.closes.length - 3]) / Math.max(series.closes[series.closes.length - 3], 1e-9) : 0;
    const featureValue = (nearSupport * 0.4 + stochRecover * 0.4 + Math.min(1, Math.max(0, momentum * 20)) * 0.2);
    const node = this.ruleTree.get(bar.tokenId)!;
    const score = this.evaluateTree(node, featureValue);
    if (score >= this.params.score_threshold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter102CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  population_size: number;
  differential_weight: number;
  crossover_prob: number;
  score_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter102CStrategy extends BaseIterStrategy<StratIter102CParams> {
  private kVals: Map<string, number[]> = new Map();
  private population: Map<string, number[][]> = new Map();
  constructor(params: Partial<StratIter102CParams> = {}) {
    super('strat_iter102_c.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      population_size: 8,
      differential_weight: 0.8,
      crossover_prob: 0.9,
      score_threshold: 0.65,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private initPopulation(size: number, dim: number): number[][] {
    const pop: number[][] = [];
    for (let i = 0; i < size; i++) {
      pop.push(Array(dim).fill(0).map(() => Math.random()));
    }
    return pop;
  }
  private deMutation(pop: number[][], idx: number, F: number): number[] {
    const others = pop.filter((_, i) => i !== idx);
    const r1 = others[Math.floor(Math.random() * others.length)];
    const r2 = others[Math.floor(Math.random() * others.length)];
    const r3 = others[Math.floor(Math.random() * others.length)];
    return r1.map((v, i) => v + F * (r2[i] - r3[i]));
  }
  private deCrossover(target: number[], mutant: number[], CR: number): number[] {
    return target.map((t, i) => Math.random() < CR ? mutant[i] : t);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.population.has(bar.tokenId)) {
      this.population.set(bar.tokenId, this.initPopulation(this.params.population_size, 5));
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
    const features: number[] = [
      bar.low <= sr.support * 1.015 ? 1 : 0,
      kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold ? 1 : 0,
      kv[kv.length - 1] < 30 ? 1 : 0,
      series.closes.length > 1 && bar.close > series.closes[series.closes.length - 2] ? 1 : 0,
      bar.close > (bar.high + bar.low) / 2 ? 1 : 0
    ];
    const pop = this.population.get(bar.tokenId)!;
    const idx = Math.floor(Math.random() * pop.length);
    const mutant = this.deMutation(pop, idx, this.params.differential_weight).map(v => Math.max(0, Math.min(1, v)));
    const trial = this.deCrossover(pop[idx], mutant, this.params.crossover_prob);
    let score = 0;
    for (let i = 0; i < trial.length; i++) {
      score += trial[i] * features[i];
    }
    score /= trial.length;
    if (score >= this.params.score_threshold) {
      pop[idx] = trial;
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter102DParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  dimension: number;
  sigma: number;
  learning_rate: number;
  score_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter102DStrategy extends BaseIterStrategy<StratIter102DParams> {
  private kVals: Map<string, number[]> = new Map();
  private mean: Map<string, number[]> = new Map();
  private cov: Map<string, number[][]> = new Map();
  private generation: Map<string, number> = new Map();
  constructor(params: Partial<StratIter102DParams> = {}) {
    super('strat_iter102_d.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      dimension: 5,
      sigma: 0.3,
      learning_rate: 0.1,
      score_threshold: 0.6,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private sampleFromMean(mean: number[], sigma: number): number[] {
    return mean.map(m => m + (Math.random() - 0.5) * 2 * sigma);
  }
  private adaptMean(mean: number[], sample: number[], outcome: number, lr: number): number[] {
    return mean.map((m, i) => m + lr * outcome * (sample[i] - m));
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.mean.has(bar.tokenId)) {
      this.mean.set(bar.tokenId, Array(this.params.dimension).fill(0.5));
      this.generation.set(bar.tokenId, 0);
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
        const outcome = bar.close > e ? 1 : -1;
        const mean = this.mean.get(bar.tokenId)!;
        this.mean.set(bar.tokenId, this.adaptMean(mean, mean, outcome, this.params.learning_rate));
        this.generation.set(bar.tokenId, (this.generation.get(bar.tokenId) || 0) + 1);
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
    const mean = this.mean.get(bar.tokenId)!;
    let score = 0;
    for (let i = 0; i < mean.length; i++) {
      score += mean[i] * features[i];
    }
    score /= mean.length;
    if (score >= this.params.score_threshold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export interface StratIter102EParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  swarm_size: number;
  inertia: number;
  cognitive: number;
  social: number;
  score_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter102EStrategy extends BaseIterStrategy<StratIter102EParams> {
  private kVals: Map<string, number[]> = new Map();
  private particles: Map<string, { position: number[]; velocity: number[]; bestPos: number[]; bestScore: number }[]> = new Map();
  private globalBest: Map<string, { pos: number[]; score: number }> = new Map();
  constructor(params: Partial<StratIter102EParams> = {}) {
    super('strat_iter102_e.params.json', {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      swarm_size: 6,
      inertia: 0.7,
      cognitive: 1.5,
      social: 1.5,
      score_threshold: 0.65,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }
  private initSwarm(size: number, dim: number): { position: number[]; velocity: number[]; bestPos: number[]; bestScore: number }[] {
    const swarm: { position: number[]; velocity: number[]; bestPos: number[]; bestScore: number }[] = [];
    for (let i = 0; i < size; i++) {
      const pos = Array(dim).fill(0).map(() => Math.random());
      swarm.push({ position: pos, velocity: Array(dim).fill(0).map(() => (Math.random() - 0.5) * 0.1), bestPos: [...pos], bestScore: 0 });
    }
    return swarm;
  }
  private updateParticle(p: { position: number[]; velocity: number[]; bestPos: number[]; bestScore: number }, gBest: number[], w: number, c1: number, c2: number): void {
    for (let i = 0; i < p.position.length; i++) {
      p.velocity[i] = w * p.velocity[i] + c1 * Math.random() * (p.bestPos[i] - p.position[i]) + c2 * Math.random() * (gBest[i] - p.position[i]);
      p.position[i] = Math.max(0, Math.min(1, p.position[i] + p.velocity[i]));
    }
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.particles.has(bar.tokenId)) {
      this.particles.set(bar.tokenId, this.initSwarm(this.params.swarm_size, 5));
      this.globalBest.set(bar.tokenId, { pos: Array(5).fill(0.5), score: 0 });
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
        const outcome = bar.close > e ? 1 : 0;
        const swarm = this.particles.get(bar.tokenId)!;
        const gBest = this.globalBest.get(bar.tokenId)!;
        for (const p of swarm) {
          if (outcome > p.bestScore) {
            p.bestScore = outcome;
            p.bestPos = [...p.position];
          }
          if (outcome > gBest.score) {
            gBest.score = outcome;
            gBest.pos = [...p.position];
          }
          this.updateParticle(p, gBest.pos, this.params.inertia, this.params.cognitive, this.params.social);
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
    const gBest = this.globalBest.get(bar.tokenId)!;
    let score = 0;
    for (let i = 0; i < gBest.pos.length; i++) {
      score += gBest.pos[i] * features[i];
    }
    score /= gBest.pos.length;
    if (score >= this.params.score_threshold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
