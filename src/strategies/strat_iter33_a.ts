import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter33AParams extends StrategyParams {
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  stoch_k_rise_min: number;
  break_below_support_pct: number;
  reclaim_within_bars: number;
  support_reclaim_buffer: number;
  resistance_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter33AParams = {
  stoch_k_period: 14,
  stoch_d_period: 3,
  stoch_oversold: 18,
  stoch_k_rise_min: 1,
  break_below_support_pct: 0.01,
  reclaim_within_bars: 4,
  support_reclaim_buffer: 0.001,
  resistance_threshold: 0.98,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter33AParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter33_a.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

type BreakdownState = {
  support: number;
  breakdownBar: number;
};

export class StratIter33AStrategy implements Strategy {
  params: StratIter33AParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private dValues: Map<string, number[]> = new Map();
  private breakdownState: Map<string, BreakdownState | null> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter33AParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter33AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period) return null;
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
  }

  private stochasticD(kValues: number[], period: number): number | null {
    if (kValues.length < period) return null;
    const slice = kValues.slice(-period);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  }

  private supportResistanceFromPriorBars(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
    if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
    const priorHighs = highs.slice(-(lookback + 1), -1);
    const priorLows = lows.slice(-(lookback + 1), -1);
    return {
      support: Math.min(...priorLows),
      resistance: Math.max(...priorHighs),
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.dValues.set(bar.tokenId, []);
      this.breakdownState.set(bar.tokenId, null);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const dVals = this.dValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 280) closes.shift();
    if (highs.length > 280) highs.shift();
    if (lows.length > 280) lows.shift();

    const k = this.stochasticK(closes, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 160) kVals.shift();

      const d = this.stochasticD(kVals, this.params.stoch_d_period);
      if (d !== null) {
        dVals.push(d);
        if (dVals.length > 160) dVals.shift();
      }
    }

    const sr = this.supportResistanceFromPriorBars(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.low <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (bar.high >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (bar.close >= sr.resistance * this.params.resistance_threshold) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (kVals.length < 2 || dVals.length < 1) return;

    const breakLevel = sr.support * (1 - this.params.break_below_support_pct);
    if (bar.low <= breakLevel) {
      this.breakdownState.set(bar.tokenId, { support: sr.support, breakdownBar: barNum });
    }

    const state = this.breakdownState.get(bar.tokenId);
    if (!state) return;

    if (barNum - state.breakdownBar > this.params.reclaim_within_bars) {
      this.breakdownState.set(bar.tokenId, null);
      return;
    }

    const currK = kVals[kVals.length - 1];
    const prevK = kVals[kVals.length - 2];
    const kRising = currK > prevK + this.params.stoch_k_rise_min;
    const notExtended = currK <= this.params.stoch_oversold + 20;
    const reclaimedSupport = bar.close >= state.support * (1 + this.params.support_reclaim_buffer);

    if (reclaimedSupport && kRising && notExtended) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
          this.breakdownState.set(bar.tokenId, null);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
