import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  downEvents: number[];
  intensity: number[];
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

function maxLast(values: number[], count: number): number {
  if (values.length === 0 || count <= 0) return 0;
  const slice = values.slice(-Math.max(1, Math.floor(count)));
  return Math.max(...slice);
}

function sumLast(values: number[], count: number): number {
  if (values.length === 0 || count <= 0) return 0;
  const slice = values.slice(-Math.max(1, Math.floor(count)));
  return slice.reduce((acc, v) => acc + v, 0);
}

export interface StratIter59CParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_hold_buffer: number;
  down_event_threshold: number;
  intensity_alpha: number;
  spike_lookback: number;
  spike_floor: number;
  decay_ratio_max: number;
  decay_drop_min: number;
  decay_jump_min: number;
  recent_event_lookback: number;
  min_recent_events: number;
  respike_abs_threshold: number;
  respike_vs_entry_add: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter59CStrategy implements Strategy {
  params: StratIter59CParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private entryIntensity: Map<string, number> = new Map();

  constructor(params: Partial<StratIter59CParams> = {}) {
    const saved = loadSavedParams<StratIter59CParams>('strat_iter59_c.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      support_hold_buffer: 0.005,
      down_event_threshold: 0.007,
      intensity_alpha: 0.25,
      spike_lookback: 20,
      spike_floor: 0.22,
      decay_ratio_max: 0.60,
      decay_drop_min: 0.10,
      decay_jump_min: 0.03,
      recent_event_lookback: 10,
      min_recent_events: 2,
      respike_abs_threshold: 0.26,
      respike_vs_entry_add: 0.08,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter59CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [], downEvents: [], intensity: [] });
      this.bars.set(bar.tokenId, 0);
    }

    const s = this.series.get(bar.tokenId)!;
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    if (prevClose !== null && prevClose > 0) {
      const ret = (bar.close - prevClose) / prevClose;
      capPush(s.returns, ret);

      const event = ret <= -Math.max(0.001, this.params.down_event_threshold) ? 1 : 0;
      capPush(s.downEvents, event);

      const prevIntensity = s.intensity.length > 0 ? s.intensity[s.intensity.length - 1] : 0;
      const alpha = Math.min(0.95, Math.max(0.05, this.params.intensity_alpha));
      const nextIntensity = alpha * event + (1 - alpha) * prevIntensity;
      capPush(s.intensity, nextIntensity);
    }

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number, intensity: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;

    const result = ctx.buy(bar.tokenId, size);
    if (!result.success) return false;

    this.entryPrice.set(bar.tokenId, bar.close);
    this.entryBar.set(bar.tokenId, barNum);
    this.entryIntensity.set(bar.tokenId, intensity);
    return true;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.entryIntensity.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (shouldSkipPrice(bar.close)) return;

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr || series.intensity.length < 2) return;

    const currIntensity = series.intensity[series.intensity.length - 1];
    const prevIntensity = series.intensity[series.intensity.length - 2];
    const spikeLookback = Math.max(2, Math.floor(this.params.spike_lookback));
    if (series.intensity.length <= spikeLookback) return;

    const priorIntensityWindow = series.intensity.slice(-(spikeLookback + 1), -1);
    const priorSpike = maxLast(priorIntensityWindow, spikeLookback);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      const enteredIntensity = this.entryIntensity.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined || enteredIntensity === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
      const intensityRespiked =
        currIntensity >= this.params.respike_abs_threshold ||
        currIntensity >= enteredIntensity + this.params.respike_vs_entry_add;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || intensityRespiked) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const recentEvents = sumLast(series.downEvents.slice(0, -1), this.params.recent_event_lookback);
    const sawSpike = priorSpike >= this.params.spike_floor;
    const abruptDecay = prevIntensity - currIntensity >= this.params.decay_jump_min;
    const decayFromSpike =
      currIntensity <= priorSpike * this.params.decay_ratio_max &&
      priorSpike - currIntensity >= this.params.decay_drop_min;
    const supportRetest = bar.low <= sr.support * (1 + this.params.support_buffer);
    const supportHeld = bar.close >= sr.support * (1 - this.params.support_hold_buffer);

    if (
      sawSpike &&
      abruptDecay &&
      decayFromSpike &&
      recentEvents >= this.params.min_recent_events &&
      supportRetest &&
      supportHeld
    ) {
      this.open(ctx, bar, barNum, currIntensity);
    }
  }
}
