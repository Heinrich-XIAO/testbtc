import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

type FeatureName = 'stoch' | 'mom_short' | 'mom_long' | 'zscore' | 'range_pullback';

type Comparator = 'lt' | 'gt';

type MicroSignal = {
  id: number;
  featureA: FeatureName;
  featureB: FeatureName;
  cmpA: Comparator;
  cmpB: Comparator;
  thresholdA: number;
  thresholdB: number;
  weightA: number;
  weightB: number;
  score: number;
  lastConfidence: number;
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

function capPush(values: number[], value: number, max = 900): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

function momentum(closes: number[], period: number): number | null {
  if (period < 1 || closes.length <= period) return null;
  const now = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - period];
  if (prev <= 0) return null;
  return (now - prev) / prev;
}

function rollingZScore(closes: number[], window: number): number | null {
  if (closes.length < window + 1) return null;
  const baseline = closes.slice(-(window + 1), -1);
  const m = mean(baseline);
  const sd = stdDev(baseline);
  if (sd <= 1e-9) return 0;
  return (closes[closes.length - 1] - m) / sd;
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function nearSupport(low: number, support: number, buffer: number): boolean {
  return low <= support * (1 + buffer);
}

function hash01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function featureDistance(value: number, threshold: number, cmp: Comparator): number {
  const raw = cmp === 'lt' ? threshold - value : value - threshold;
  return clamp(raw, -1, 1);
}

function pickFeature(seed: number): FeatureName {
  const features: FeatureName[] = ['stoch', 'mom_short', 'mom_long', 'zscore', 'range_pullback'];
  return features[Math.floor(hash01(seed) * features.length) % features.length];
}

export interface StratIter55CParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  stoch_period: number;
  short_mom_period: number;
  long_mom_period: number;
  zscore_window: number;
  feature_clip: number;
  pool_size: number;
  mutate_interval_bars: number;
  mutate_rate: number;
  crossover_bias: number;
  elite_count: number;
  score_decay: number;
  score_gain: number;
  champion_entry_conf: number;
  champion_min_score: number;
  confidence_collapse: number;
  collapse_from_entry_delta: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter55CStrategy implements Strategy {
  params: StratIter55CParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private entryChampionConfidence: Map<string, number> = new Map();
  private pools: Map<string, MicroSignal[]> = new Map();

  constructor(params: Partial<StratIter55CParams> = {}) {
    const saved = loadSavedParams<StratIter55CParams>('strat_iter55_c.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      stoch_period: 14,
      short_mom_period: 3,
      long_mom_period: 12,
      zscore_window: 18,
      feature_clip: 0.06,
      pool_size: 10,
      mutate_interval_bars: 8,
      mutate_rate: 0.22,
      crossover_bias: 0.55,
      elite_count: 3,
      score_decay: 0.95,
      score_gain: 0.35,
      champion_entry_conf: 0.66,
      champion_min_score: 0.02,
      confidence_collapse: 0.42,
      collapse_from_entry_delta: 0.22,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter55CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private buildFeatures(series: TokenSeries, bar: Bar, support: number, resistance: number): Record<FeatureName, number> | null {
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_period);
    const momShort = momentum(series.closes, this.params.short_mom_period);
    const momLong = momentum(series.closes, this.params.long_mom_period);
    const z = rollingZScore(series.closes, this.params.zscore_window);
    if (k === null || momShort === null || momLong === null || z === null) return null;

    const clip = this.params.feature_clip;
    const rangeDen = Math.max(1e-6, resistance - support);
    const rangePos = clamp((bar.close - support) / rangeDen, 0, 1);

    return {
      stoch: clamp(k / 100, 0, 1),
      mom_short: clamp(momShort / clip, -1, 1) * 0.5 + 0.5,
      mom_long: clamp(momLong / clip, -1, 1) * 0.5 + 0.5,
      zscore: clamp(z / 3, -1, 1) * 0.5 + 0.5,
      range_pullback: 1 - rangePos,
    };
  }

  private createRandomSignal(seed: number, id: number): MicroSignal {
    const featureA = pickFeature(seed + 11);
    let featureB = pickFeature(seed + 29);
    if (featureB === featureA) featureB = pickFeature(seed + 47);

    return {
      id,
      featureA,
      featureB,
      cmpA: hash01(seed + 3) < 0.5 ? 'lt' : 'gt',
      cmpB: hash01(seed + 5) < 0.5 ? 'lt' : 'gt',
      thresholdA: 0.2 + hash01(seed + 7) * 0.6,
      thresholdB: 0.2 + hash01(seed + 13) * 0.6,
      weightA: 0.7 + hash01(seed + 17) * 0.8,
      weightB: 0.7 + hash01(seed + 19) * 0.8,
      score: 0,
      lastConfidence: 0,
    };
  }

  private ensurePool(tokenId: string): MicroSignal[] {
    const existing = this.pools.get(tokenId);
    if (existing) return existing;

    const created: MicroSignal[] = [];
    for (let i = 0; i < this.params.pool_size; i++) {
      created.push(this.createRandomSignal((tokenId.length + 1) * (i + 1), i + 1));
    }
    this.pools.set(tokenId, created);
    return created;
  }

  private signalConfidence(signal: MicroSignal, features: Record<FeatureName, number>): number {
    const distA = featureDistance(features[signal.featureA], signal.thresholdA, signal.cmpA);
    const distB = featureDistance(features[signal.featureB], signal.thresholdB, signal.cmpB);
    const weighted = (distA * signal.weightA + distB * signal.weightB) / (signal.weightA + signal.weightB);
    return clamp(0.5 + weighted * 0.8, 0, 1);
  }

  private updateScores(pool: MicroSignal[], realizedReturn: number): void {
    for (const signal of pool) {
      const pred = signal.lastConfidence;
      const direction = pred - 0.5;
      const normalizedRet = clamp(realizedReturn / this.params.feature_clip, -1, 1);
      const reward = direction * normalizedRet;
      signal.score = signal.score * this.params.score_decay + reward * this.params.score_gain;
    }
  }

  private crossover(a: MicroSignal, b: MicroSignal, seed: number, id: number): MicroSignal {
    const pickA = hash01(seed + 1) < this.params.crossover_bias;
    const pickB = hash01(seed + 2) < this.params.crossover_bias;
    const child: MicroSignal = {
      id,
      featureA: pickA ? a.featureA : b.featureA,
      featureB: pickB ? a.featureB : b.featureB,
      cmpA: hash01(seed + 3) < 0.5 ? a.cmpA : b.cmpA,
      cmpB: hash01(seed + 4) < 0.5 ? a.cmpB : b.cmpB,
      thresholdA: clamp((a.thresholdA + b.thresholdA) * 0.5, 0.1, 0.9),
      thresholdB: clamp((a.thresholdB + b.thresholdB) * 0.5, 0.1, 0.9),
      weightA: clamp((a.weightA + b.weightA) * 0.5, 0.3, 1.8),
      weightB: clamp((a.weightB + b.weightB) * 0.5, 0.3, 1.8),
      score: (a.score + b.score) * 0.25,
      lastConfidence: 0,
    };
    return this.mutate(child, seed + 100);
  }

  private mutate(signal: MicroSignal, seed: number): MicroSignal {
    const out = { ...signal };
    const mutateRate = this.params.mutate_rate;

    if (hash01(seed + 1) < mutateRate) out.thresholdA = clamp(out.thresholdA + (hash01(seed + 2) - 0.5) * 0.18, 0.1, 0.9);
    if (hash01(seed + 3) < mutateRate) out.thresholdB = clamp(out.thresholdB + (hash01(seed + 4) - 0.5) * 0.18, 0.1, 0.9);
    if (hash01(seed + 5) < mutateRate) out.weightA = clamp(out.weightA + (hash01(seed + 6) - 0.5) * 0.35, 0.3, 1.8);
    if (hash01(seed + 7) < mutateRate) out.weightB = clamp(out.weightB + (hash01(seed + 8) - 0.5) * 0.35, 0.3, 1.8);
    if (hash01(seed + 9) < mutateRate * 0.5) out.cmpA = out.cmpA === 'lt' ? 'gt' : 'lt';
    if (hash01(seed + 10) < mutateRate * 0.5) out.cmpB = out.cmpB === 'lt' ? 'gt' : 'lt';
    if (hash01(seed + 11) < mutateRate * 0.6) out.featureA = pickFeature(seed + 12);
    if (hash01(seed + 13) < mutateRate * 0.6) out.featureB = pickFeature(seed + 14);
    if (out.featureA === out.featureB) out.featureB = pickFeature(seed + 15);
    return out;
  }

  private evolvePool(tokenId: string, pool: MicroSignal[], barNum: number): MicroSignal[] {
    const sorted = [...pool].sort((a, b) => b.score - a.score);
    const eliteCount = Math.max(1, Math.min(this.params.elite_count, sorted.length));
    const elites = sorted.slice(0, eliteCount).map((s, i) => ({ ...s, id: i + 1 }));

    const next: MicroSignal[] = [...elites];
    let id = next.length + 1;

    while (next.length < this.params.pool_size) {
      const a = elites[Math.floor(hash01((barNum + id) * 17 + tokenId.length) * elites.length) % elites.length];
      const b = sorted[Math.floor(hash01((barNum + id) * 31 + tokenId.length) * sorted.length) % sorted.length];
      next.push(this.crossover(a, b, barNum * 41 + id * 13 + tokenId.length, id));
      id += 1;
    }

    return next;
  }

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
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

  private open(ctx: BacktestContext, bar: Bar, barNum: number, confidence: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;

    const result = ctx.buy(bar.tokenId, size);
    if (!result.success) return false;

    this.entryPrice.set(bar.tokenId, bar.close);
    this.entryBar.set(bar.tokenId, barNum);
    this.entryChampionConfidence.set(bar.tokenId, confidence);
    return true;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.entryChampionConfidence.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    const pool = this.ensurePool(bar.tokenId);

    if (!sr || shouldSkipPrice(bar.close)) return;

    if (series.closes.length >= 2) {
      const prevClose = series.closes[series.closes.length - 2];
      if (prevClose > 0) {
        const ret = (series.closes[series.closes.length - 1] - prevClose) / prevClose;
        this.updateScores(pool, ret);
      }
    }

    const features = this.buildFeatures(series, bar, sr.support, sr.resistance);
    if (!features) return;

    for (const signal of pool) {
      signal.lastConfidence = this.signalConfidence(signal, features);
    }

    if (barNum % Math.max(2, this.params.mutate_interval_bars) === 0) {
      const evolved = this.evolvePool(bar.tokenId, pool, barNum);
      this.pools.set(bar.tokenId, evolved);
    }

    const livePool = this.pools.get(bar.tokenId)!;
    const champion = [...livePool].sort((a, b) => b.score - a.score)[0];
    const championConfidence = champion ? this.signalConfidence(champion, features) : 0;

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      const entryChampion = this.entryChampionConfidence.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined || entryChampion === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * 0.985;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
      const confidenceCollapsed =
        championConfidence <= this.params.confidence_collapse ||
        entryChampion - championConfidence >= this.params.collapse_from_entry_delta;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || confidenceCollapsed) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const supportPass = nearSupport(bar.low, sr.support, this.params.support_buffer);
    if (
      champion &&
      champion.score >= this.params.champion_min_score &&
      championConfidence >= this.params.champion_entry_conf &&
      supportPass
    ) {
      this.open(ctx, bar, barNum, championConfidence);
    }
  }
}
