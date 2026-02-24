import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  hfEnergyHistory: number[];
  lfEnergyHistory: number[];
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

function sma(values: number[], period: number): number | null {
  if (period < 1 || values.length < period) return null;
  return mean(values.slice(-period));
}

function momentum(closes: number[], period: number): number | null {
  if (period < 1 || closes.length <= period) return null;
  const now = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - period];
  if (prev <= 0) return null;
  return (now - prev) / prev;
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

export interface StratIter56CParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  ma_scale_1: number;
  ma_scale_2: number;
  ma_scale_3: number;
  ma_scale_4: number;
  energy_smooth_window: number;
  lf_dom_ratio_threshold: number;
  min_lf_energy: number;
  reversal_mom_period: number;
  reversal_prev_floor: number;
  reversal_confirm: number;
  hf_spike_window: number;
  hf_spike_multiplier: number;
  hf_ratio_exit_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter56CStrategy implements Strategy {
  params: StratIter56CParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private prevMomentum: Map<string, number> = new Map();

  constructor(params: Partial<StratIter56CParams> = {}) {
    const saved = loadSavedParams<StratIter56CParams>('strat_iter56_c.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      ma_scale_1: 3,
      ma_scale_2: 9,
      ma_scale_3: 21,
      ma_scale_4: 45,
      energy_smooth_window: 12,
      lf_dom_ratio_threshold: 1.25,
      min_lf_energy: 0.000015,
      reversal_mom_period: 2,
      reversal_prev_floor: -0.006,
      reversal_confirm: 0.001,
      hf_spike_window: 20,
      hf_spike_multiplier: 2.2,
      hf_ratio_exit_threshold: 0.85,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter56CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, {
        closes: [],
        highs: [],
        lows: [],
        hfEnergyHistory: [],
        lfEnergyHistory: [],
      });
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

  private computeWaveletEnergy(series: TokenSeries): { hfEnergy: number; lfEnergy: number; ratio: number } | null {
    const m1 = sma(series.closes, this.params.ma_scale_1);
    const m2 = sma(series.closes, this.params.ma_scale_2);
    const m3 = sma(series.closes, this.params.ma_scale_3);
    const m4 = sma(series.closes, this.params.ma_scale_4);
    if (m1 === null || m2 === null || m3 === null || m4 === null) return null;

    const d1 = m1 - m2;
    const d2 = m2 - m3;
    const d3 = m3 - m4;
    const trendApprox = series.closes[series.closes.length - 1] - m4;

    const hfRaw = d1 * d1 + d2 * d2;
    const lfRaw = d3 * d3 + trendApprox * trendApprox * 0.5;

    capPush(series.hfEnergyHistory, hfRaw);
    capPush(series.lfEnergyHistory, lfRaw);

    const smooth = Math.max(2, this.params.energy_smooth_window);
    if (series.hfEnergyHistory.length < smooth || series.lfEnergyHistory.length < smooth) return null;

    const hfEnergy = mean(series.hfEnergyHistory.slice(-smooth));
    const lfEnergy = mean(series.lfEnergyHistory.slice(-smooth));
    const ratio = lfEnergy / Math.max(1e-9, hfEnergy);
    return { hfEnergy, lfEnergy, ratio };
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

    const wave = this.computeWaveletEnergy(series);
    const mom = momentum(series.closes, this.params.reversal_mom_period);
    if (!wave || mom === null) return;

    const prevMom = this.prevMomentum.get(bar.tokenId);
    this.prevMomentum.set(bar.tokenId, mom);

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * 0.985;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;

      const spikeWindow = Math.max(4, this.params.hf_spike_window);
      const hfBaselineSlice = series.hfEnergyHistory.slice(-spikeWindow, -1);
      const hfBaseline = hfBaselineSlice.length > 0 ? mean(hfBaselineSlice) : wave.hfEnergy;
      const highFrequencySpike =
        wave.hfEnergy >= hfBaseline * this.params.hf_spike_multiplier &&
        wave.ratio <= this.params.hf_ratio_exit_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || highFrequencySpike) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (prevMom === undefined) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const lowFreqDominant = wave.ratio >= this.params.lf_dom_ratio_threshold && wave.lfEnergy >= this.params.min_lf_energy;
    const reversalSignal = prevMom <= this.params.reversal_prev_floor && mom >= this.params.reversal_confirm && bar.close > sr.support;

    if (nearSupport && lowFreqDominant && reversalSignal) {
      this.open(ctx, bar, barNum);
    }
  }
}
