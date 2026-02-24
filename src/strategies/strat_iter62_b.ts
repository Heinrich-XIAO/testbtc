import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  particles: number[];
  weights: number[];
  posterior: number;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) * (v - m)));
  return Math.sqrt(Math.max(0, variance));
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

function hashToken(tokenId: string): number {
  let h = 2166136261;
  for (let i = 0; i < tokenId.length; i++) {
    h ^= tokenId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicNoise(tokenHash: number, barNum: number, index: number): number {
  const x = Math.sin((tokenHash + 1) * 0.0001 + (barNum + 1) * 12.9898 + (index + 1) * 78.233) * 43758.5453;
  const frac = x - Math.floor(x);
  return frac * 2 - 1;
}

export interface StratIter62BParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  support_touch_window: number;
  min_support_touches: number;
  particle_count: number;
  trend_persistence: number;
  drift_from_recent_return: number;
  process_noise: number;
  observation_window: number;
  likelihood_sigma_floor: number;
  reversal_trend_cutoff: number;
  rebound_return_min: number;
  posterior_entry_threshold: number;
  posterior_defensive_threshold: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter62BStrategy implements Strategy {
  params: StratIter62BParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private tokenHashes: Map<string, number> = new Map();

  constructor(params: Partial<StratIter62BParams> = {}) {
    const saved = loadSavedParams<StratIter62BParams>('strat_iter62_b.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      support_touch_window: 12,
      min_support_touches: 2,
      particle_count: 41,
      trend_persistence: 0.86,
      drift_from_recent_return: 5.2,
      process_noise: 0.19,
      observation_window: 9,
      likelihood_sigma_floor: 0.002,
      reversal_trend_cutoff: -0.18,
      rebound_return_min: 0.001,
      posterior_entry_threshold: 0.68,
      posterior_defensive_threshold: 0.42,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter62BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private getTokenHash(tokenId: string): number {
    let h = this.tokenHashes.get(tokenId);
    if (h !== undefined) return h;
    h = hashToken(tokenId);
    this.tokenHashes.set(tokenId, h);
    return h;
  }

  private initializeParticles(tokenId: string, particleCount: number): { particles: number[]; weights: number[] } {
    const count = Math.max(7, Math.floor(particleCount));
    const tokenHash = this.getTokenHash(tokenId);
    const particles: number[] = [];
    const weights: number[] = [];
    for (let i = 0; i < count; i++) {
      particles.push(clamp(deterministicNoise(tokenHash, 1, i) * 0.5, -1, 1));
      weights.push(1 / count);
    }
    return { particles, weights };
  }

  private getState(tokenId: string): TokenState {
    let s = this.state.get(tokenId);
    if (s) return s;

    const initialized = this.initializeParticles(tokenId, this.params.particle_count);
    s = {
      closes: [],
      highs: [],
      lows: [],
      returns: [],
      particles: initialized.particles,
      weights: initialized.weights,
      posterior: 0,
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

  private effectiveSampleSize(weights: number[]): number {
    const sumSq = weights.reduce((acc, w) => acc + w * w, 0);
    if (sumSq <= 0) return 0;
    return 1 / sumSq;
  }

  private systematicResample(s: TokenState, tokenHash: number): void {
    const n = s.particles.length;
    const cumulative: number[] = new Array(n);
    let running = 0;
    for (let i = 0; i < n; i++) {
      running += s.weights[i];
      cumulative[i] = running;
    }

    const start = (deterministicNoise(tokenHash, s.barNum, 991) + 1) * 0.5 / n;
    const nextParticles: number[] = new Array(n);
    let i = 0;
    for (let m = 0; m < n; m++) {
      const u = start + m / n;
      while (i < n - 1 && u > cumulative[i]) i++;
      nextParticles[m] = s.particles[i];
    }
    s.particles = nextParticles;
    s.weights = Array.from({ length: n }, () => 1 / n);
  }

  private updatePosterior(s: TokenState, tokenId: string): number {
    const n = s.particles.length;
    if (s.returns.length < 2) {
      s.posterior = 0;
      return 0;
    }

    const obsWindow = Math.max(3, Math.floor(this.params.observation_window));
    const recentReturns = s.returns.slice(-obsWindow);
    const obsMean = mean(recentReturns);
    const obsSigma = Math.max(this.params.likelihood_sigma_floor, stdDev(recentReturns));
    const tokenHash = this.getTokenHash(tokenId);
    const recentRet = s.returns[s.returns.length - 1];

    let weightSum = 0;
    for (let i = 0; i < n; i++) {
      const noise = deterministicNoise(tokenHash, s.barNum, i) * this.params.process_noise;
      const predicted =
        s.particles[i] * this.params.trend_persistence +
        this.params.drift_from_recent_return * recentRet +
        noise;
      const clampedParticle = clamp(predicted, -1, 1);
      s.particles[i] = clampedParticle;

      const expectedObs = clampedParticle * obsSigma;
      const residual = obsMean - expectedObs;
      const likelihood = Math.exp(-(residual * residual) / (2 * obsSigma * obsSigma));
      s.weights[i] = Math.max(1e-12, s.weights[i] * likelihood);
      weightSum += s.weights[i];
    }

    if (weightSum <= 0) {
      s.weights = Array.from({ length: n }, () => 1 / n);
    } else {
      for (let i = 0; i < n; i++) s.weights[i] /= weightSum;
    }

    const ess = this.effectiveSampleSize(s.weights);
    if (ess < n * 0.52) this.systematicResample(s, tokenHash);

    let reversalMass = 0;
    for (let i = 0; i < n; i++) {
      if (s.particles[i] <= this.params.reversal_trend_cutoff) reversalMass += s.weights[i];
    }
    s.posterior = clamp(reversalMass, 0, 1);
    return s.posterior;
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

    const posterior = this.updatePosterior(s, bar.tokenId);
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
      const posteriorDefensiveDrop = posterior <= this.params.posterior_defensive_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || posteriorDefensiveDrop) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const touchWindow = Math.max(3, Math.floor(this.params.support_touch_window));
    const recentLows = s.lows.slice(-touchWindow);
    const supportTouches = recentLows.filter((low) => low <= sr.support * (1 + this.params.support_buffer)).length;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const reclaiming = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);

    const recentReturn = s.returns.length > 0 ? s.returns[s.returns.length - 1] : 0;
    const reboundSeen = recentReturn >= this.params.rebound_return_min;

    const entrySignal =
      nearSupport &&
      reclaiming &&
      supportTouches >= Math.max(1, Math.floor(this.params.min_support_touches)) &&
      reboundSeen &&
      posterior >= this.params.posterior_entry_threshold;

    if (entrySignal) this.open(ctx, bar, s.barNum);
  }
}
