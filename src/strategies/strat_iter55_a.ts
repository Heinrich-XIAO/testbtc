import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  volHistory: number[];
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

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
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

function realizedVolatility(closes: number[], window: number): number | null {
  if (window < 2 || closes.length < window + 1) return null;
  const returns: number[] = [];
  const start = closes.length - (window + 1);
  for (let i = start + 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const next = closes[i];
    if (prev <= 0) return null;
    returns.push((next - prev) / prev);
  }
  return stdDev(returns);
}

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0.5;
  let belowOrEqual = 0;
  for (const v of values) {
    if (v <= value) belowOrEqual += 1;
  }
  return belowOrEqual / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function momentum(closes: number[], lookback: number): number | null {
  if (lookback < 1 || closes.length <= lookback) return null;
  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - lookback];
  if (past <= 0) return null;
  return (current - past) / past;
}

export interface StratIter55AParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  vol_window: number;
  vol_percentile_window: number;
  min_dynamic_lookback: number;
  max_dynamic_lookback: number;
  warp_fast_period: number;
  warp_fast_weight: number;
  warp_vol_gain: number;
  entry_warped_threshold: number;
  exit_warped_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter55AStrategy implements Strategy {
  params: StratIter55AParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private prevWarpedMomentum: Map<string, number> = new Map();

  constructor(params: Partial<StratIter55AParams> = {}) {
    const saved = loadSavedParams<StratIter55AParams>('strat_iter55_a.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      vol_window: 12,
      vol_percentile_window: 80,
      min_dynamic_lookback: 5,
      max_dynamic_lookback: 50,
      warp_fast_period: 3,
      warp_fast_weight: 0.45,
      warp_vol_gain: 0.9,
      entry_warped_threshold: 0.002,
      exit_warped_threshold: -0.008,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter55AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], volHistory: [] });
      this.bars.set(bar.tokenId, 0);
    }

    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    const vol = realizedVolatility(s.closes, this.params.vol_window);
    if (vol !== null) capPush(s.volHistory, vol);

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private dynamicLookback(volHistory: number[]): number | null {
    if (volHistory.length < this.params.vol_percentile_window) return null;
    const sample = volHistory.slice(-this.params.vol_percentile_window);
    const currentVol = sample[sample.length - 1];
    const volPct = percentileRank(sample, currentVol);
    const span = this.params.max_dynamic_lookback - this.params.min_dynamic_lookback;
    const lookback = Math.round(this.params.max_dynamic_lookback - volPct * span);
    return clamp(lookback, this.params.min_dynamic_lookback, this.params.max_dynamic_lookback);
  }

  private warpedMomentum(closes: number[], volHistory: number[]): number | null {
    const dynLookback = this.dynamicLookback(volHistory);
    if (dynLookback === null) return null;

    const baseMom = momentum(closes, dynLookback);
    const fastMom = momentum(closes, this.params.warp_fast_period);
    if (baseMom === null || fastMom === null) return null;

    const sample = volHistory.slice(-this.params.vol_percentile_window);
    const currentVol = sample[sample.length - 1];
    const volPct = percentileRank(sample, currentVol);
    const volatilityWarp = 1 + this.params.warp_vol_gain * (volPct - 0.5) * 2;
    return baseMom * volatilityWarp + fastMom * this.params.warp_fast_weight;
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
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (!sr || shouldSkipPrice(bar.close)) return;

    const warped = this.warpedMomentum(series.closes, series.volHistory);
    if (warped === null) return;

    const prevWarped = this.prevWarpedMomentum.get(bar.tokenId);
    this.prevWarpedMomentum.set(bar.tokenId, warped);

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * 0.985;
      const maxHoldReached = barNum - entryBar >= this.params.max_hold_bars;
      const warpedMomentumBreak = warped <= this.params.exit_warped_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || warpedMomentumBreak) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (prevWarped === undefined) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const positiveTurn = prevWarped <= 0 && warped > this.params.entry_warped_threshold;

    if (nearSupport && positiveTurn) {
      this.open(ctx, bar, barNum);
    }
  }
}
