import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

type Particle = {
  trend: number;
  weight: number;
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

class ParticleFilter {
  private particles: Particle[] = [];
  private nParticles: number;
  private noiseStd: number;
  private initialized: boolean = false;

  constructor(nParticles: number, noiseStd: number) {
    this.nParticles = nParticles;
    this.noiseStd = noiseStd;
  }

  initialize(initialTrend: number): void {
    this.particles = [];
    for (let i = 0; i < this.nParticles; i++) {
      this.particles.push({
        trend: initialTrend + (Math.random() - 0.5) * 0.1,
        weight: 1 / this.nParticles,
      });
    }
    this.initialized = true;
  }

  predict(): void {
    for (const p of this.particles) {
      p.trend += (Math.random() - 0.5) * 2 * this.noiseStd;
    }
  }

  update(price: number): void {
    let totalWeight = 0;
    for (const p of this.particles) {
      const diff = Math.abs(price - p.trend);
      const likelihood = Math.exp(-diff * diff / 0.02);
      p.weight *= likelihood;
      totalWeight += p.weight;
    }
    if (totalWeight > 0) {
      for (const p of this.particles) {
        p.weight /= totalWeight;
      }
    }
  }

  resample(): void {
    const cumulative: number[] = [];
    let sum = 0;
    for (const p of this.particles) {
      sum += p.weight;
      cumulative.push(sum);
    }

    const newParticles: Particle[] = [];
    for (let i = 0; i < this.nParticles; i++) {
      const r = Math.random();
      let idx = 0;
      for (let j = 0; j < cumulative.length; j++) {
        if (r <= cumulative[j]) {
          idx = j;
          break;
        }
      }
      newParticles.push({
        trend: this.particles[idx].trend,
        weight: 1 / this.nParticles,
      });
    }
    this.particles = newParticles;
  }

  getEstimate(): { trend: number; variance: number } | null {
    if (!this.initialized || this.particles.length === 0) return null;
    
    let weightedMean = 0;
    let totalWeight = 0;
    for (const p of this.particles) {
      weightedMean += p.trend * p.weight;
      totalWeight += p.weight;
    }
    if (totalWeight === 0) return null;
    weightedMean /= totalWeight;

    let variance = 0;
    for (const p of this.particles) {
      variance += p.weight * Math.pow(p.trend - weightedMean, 2);
    }
    variance /= totalWeight;

    return { trend: weightedMean, variance };
  }

  isInitialized(): boolean {
    return this.initialized;
  }
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

export interface StratIter81BParams extends StrategyParams {
  n_particles: number;
  noise_std: number;
  deviation_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter81BStrategy extends BaseIterStrategy<StratIter81BParams> {
  private particleFilters: Map<string, ParticleFilter> = new Map();

  constructor(params: Partial<StratIter81BParams> = {}) {
    super('strat_iter81_b.params.json', {
      n_particles: 100,
      noise_std: 0.03,
      deviation_threshold: 2.0,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    if (!this.particleFilters.has(bar.tokenId)) {
      this.particleFilters.set(bar.tokenId, new ParticleFilter(this.params.n_particles, this.params.noise_std));
    }
    const pf = this.particleFilters.get(bar.tokenId)!;

    if (!pf.isInitialized() && series.closes.length >= 10) {
      const sma = series.closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
      pf.initialize(sma);
    }

    if (pf.isInitialized()) {
      pf.predict();
      pf.update(bar.close);
      pf.resample();
    }

    const estimate = pf.getEstimate();

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          (sr && bar.high >= sr.resistance * 0.98) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || !estimate) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const stdDev = Math.sqrt(estimate.variance);
    const deviation = (estimate.trend - bar.close) / (stdDev > 0.001 ? stdDev : 0.001);
    const belowTrend = deviation >= this.params.deviation_threshold;

    if (nearSupport && stochOversold && belowTrend) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
