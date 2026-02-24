import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
};

type PrimaryFeatures = {
  stochBucket: number;
  supportBucket: number;
  momentumBucket: number;
  volBucket: number;
};

type PendingLabel = {
  barNum: number;
  entryPrice: number;
  features: PrimaryFeatures;
};

type BetaCounter = {
  success: number;
  fail: number;
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

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function avgLast(values: number[], n: number): number {
  if (values.length === 0) return 0;
  const count = Math.max(1, Math.floor(n));
  const slice = values.slice(-count);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}

function stdLast(values: number[], n: number): number {
  if (values.length < 2) return 0;
  const count = Math.max(2, Math.floor(n));
  const slice = values.slice(-count);
  if (slice.length < 2) return 0;
  const mean = slice.reduce((sum, v) => sum + v, 0) / slice.length;
  const varMean = slice.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / slice.length;
  return Math.sqrt(Math.max(0, varMean));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function bucketize(value: number, min: number, max: number, buckets: number): number {
  const b = Math.max(2, Math.floor(buckets));
  const v = clamp(value, min, max);
  const unit = (v - min) / Math.max(1e-12, max - min);
  return Math.min(b - 1, Math.floor(unit * b));
}

function keyify(prefix: string, features: PrimaryFeatures): string {
  return `${prefix}_${features.stochBucket}_${features.supportBucket}_${features.momentumBucket}_${features.volBucket}`;
}

function getCounter(map: Map<string, BetaCounter>, key: string): BetaCounter {
  let counter = map.get(key);
  if (!counter) {
    counter = { success: 0, fail: 0 };
    map.set(key, counter);
  }
  return counter;
}

function updateCounter(map: Map<string, BetaCounter>, key: string, success: boolean): void {
  const c = getCounter(map, key);
  if (success) c.success += 1;
  else c.fail += 1;
}

function betaMean(counter: BetaCounter | null, priorStrength: number): number {
  if (!counter) return 0.5;
  const alpha = counter.success + priorStrength;
  const beta = counter.fail + priorStrength;
  return alpha / (alpha + beta);
}

export interface StratIter61CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  support_buffer: number;
  support_hold_buffer: number;
  resistance_exit_buffer: number;
  meta_lookback_returns: number;
  meta_horizon_bars: number;
  meta_success_return: number;
  meta_prior_strength: number;
  meta_min_samples: number;
  meta_entry_threshold: number;
  meta_decay_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter61CStrategy implements Strategy {
  params: StratIter61CParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private pendingLabels: Map<string, PendingLabel[]> = new Map();
  private metaStats: Map<string, BetaCounter> = new Map();

  constructor(params: Partial<StratIter61CParams> = {}) {
    const saved = loadSavedParams<StratIter61CParams>('strat_iter61_c.params.json');
    this.params = {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      support_buffer: 0.016,
      support_hold_buffer: 0.006,
      resistance_exit_buffer: 0.985,
      meta_lookback_returns: 16,
      meta_horizon_bars: 8,
      meta_success_return: 0.01,
      meta_prior_strength: 2.5,
      meta_min_samples: 20,
      meta_entry_threshold: 0.58,
      meta_decay_threshold: 0.46,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter61CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [] });
      this.bars.set(bar.tokenId, 0);
      this.pendingLabels.set(bar.tokenId, []);
    }

    const s = this.series.get(bar.tokenId)!;
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    if (prevClose !== null && prevClose > 0) {
      capPush(s.returns, (bar.close - prevClose) / prevClose);
    }

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private featuresFromSignal(series: TokenSeries, support: number, k: number): PrimaryFeatures | null {
    if (series.returns.length < 4 || support <= 0) return null;

    const lookback = Math.max(4, Math.floor(this.params.meta_lookback_returns));
    const momentum = avgLast(series.returns, lookback);
    const vol = stdLast(series.returns, lookback);
    const close = series.closes[series.closes.length - 1];
    const supportDistance = (close - support) / support;

    return {
      stochBucket: bucketize(k, 0, 100, 8),
      supportBucket: bucketize(supportDistance, -0.02, 0.06, 8),
      momentumBucket: bucketize(momentum, -0.02, 0.02, 8),
      volBucket: bucketize(vol, 0, 0.03, 8),
    };
  }

  private updateMetaLabels(tokenId: string, barNum: number, close: number): void {
    const queue = this.pendingLabels.get(tokenId);
    if (!queue || queue.length === 0) return;

    const horizon = Math.max(2, Math.floor(this.params.meta_horizon_bars));
    const keep: PendingLabel[] = [];

    for (const pending of queue) {
      if (barNum - pending.barNum < horizon) {
        keep.push(pending);
        continue;
      }

      if (pending.entryPrice <= 0) continue;
      const fwdReturn = (close - pending.entryPrice) / pending.entryPrice;
      const success = fwdReturn >= this.params.meta_success_return;
      updateCounter(this.metaStats, 'global', success);
      updateCounter(this.metaStats, `stoch_${pending.features.stochBucket}`, success);
      updateCounter(this.metaStats, `support_${pending.features.supportBucket}`, success);
      updateCounter(this.metaStats, `mom_${pending.features.momentumBucket}`, success);
      updateCounter(this.metaStats, `vol_${pending.features.volBucket}`, success);
      updateCounter(this.metaStats, keyify('joint', pending.features), success);
    }

    this.pendingLabels.set(tokenId, keep);
  }

  private metaConfidence(features: PrimaryFeatures): { conf: number; samples: number } {
    const prior = Math.max(0.5, this.params.meta_prior_strength);

    const global = this.metaStats.get('global') || null;
    const stoch = this.metaStats.get(`stoch_${features.stochBucket}`) || null;
    const support = this.metaStats.get(`support_${features.supportBucket}`) || null;
    const mom = this.metaStats.get(`mom_${features.momentumBucket}`) || null;
    const vol = this.metaStats.get(`vol_${features.volBucket}`) || null;
    const joint = this.metaStats.get(keyify('joint', features)) || null;

    const pGlobal = betaMean(global, prior);
    const pStoch = betaMean(stoch, prior);
    const pSupport = betaMean(support, prior);
    const pMom = betaMean(mom, prior);
    const pVol = betaMean(vol, prior);
    const pJoint = betaMean(joint, prior);

    const conf =
      0.24 * pGlobal +
      0.14 * pStoch +
      0.14 * pSupport +
      0.14 * pMom +
      0.14 * pVol +
      0.20 * pJoint;

    const samples = (global?.success || 0) + (global?.fail || 0);
    return { conf, samples };
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
    const { series, barNum } = this.nextBar(bar);
    if (shouldSkipPrice(bar.close)) return;

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const k = stochK(series.closes, series.highs, series.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));
    if (!sr || k === null) return;

    this.updateMetaLabels(bar.tokenId, barNum, bar.close);

    const features = this.featuresFromSignal(series, sr.support, k);
    if (!features) return;

    const meta = this.metaConfidence(features);
    const primarySignal =
      bar.low <= sr.support * (1 + this.params.support_buffer) &&
      bar.close >= sr.support * (1 - this.params.support_hold_buffer) &&
      k <= this.params.stoch_oversold;

    if (primarySignal) {
      const pending = this.pendingLabels.get(bar.tokenId);
      if (pending) {
        pending.push({ barNum, entryPrice: bar.close, features });
        if (pending.length > 500) pending.shift();
      }
    }

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
      const metaDecayed = meta.samples >= this.params.meta_min_samples && meta.conf <= this.params.meta_decay_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || metaDecayed) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const metaPasses = meta.samples >= this.params.meta_min_samples && meta.conf >= this.params.meta_entry_threshold;
    if (primarySignal && metaPasses) {
      this.open(ctx, bar, barNum);
    }
  }
}
