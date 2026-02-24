import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter35CParams extends StrategyParams {
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  support_threshold: number;
  resistance_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
  contraction_lookback: number;
  baseline_lookback: number;
  contraction_ratio_threshold: number;
  breakout_buffer: number;
  expansion_check_bars: number;
  expansion_factor: number;
}

const defaultParams: StratIter35CParams = {
  stoch_k_period: 14,
  stoch_d_period: 3,
  stoch_oversold: 16,
  support_threshold: 0.01,
  resistance_threshold: 0.98,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
  contraction_lookback: 8,
  baseline_lookback: 32,
  contraction_ratio_threshold: 0.7,
  breakout_buffer: 0.004,
  expansion_check_bars: 5,
  expansion_factor: 1.35,
};

function loadSavedParams(): Partial<StratIter35CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter35_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter35CStrategy implements Strategy {
  params: StratIter35CParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private dValues: Map<string, number[]> = new Map();
  private barCount: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private entryContractionRange: Map<string, number> = new Map();

  constructor(params: Partial<StratIter35CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter35CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period) return null;
    const highest = Math.max(...highs.slice(-period));
    const lowest = Math.min(...lows.slice(-period));
    if (highest === lowest) return 50;
    const close = closes[closes.length - 1];
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  private stochasticD(kValues: number[], period: number): number | null {
    if (kValues.length < period) return null;
    const window = kValues.slice(-period);
    return window.reduce((sum, value) => sum + value, 0) / period;
  }

  private supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } {
    return {
      support: Math.min(...lows.slice(-lookback)),
      resistance: Math.max(...highs.slice(-lookback)),
    };
  }

  private normalizedRange(highs: number[], lows: number[], lookback: number, referencePrice: number): number | null {
    if (highs.length < lookback || lows.length < lookback || referencePrice <= 0) return null;
    const rangeHigh = Math.max(...highs.slice(-lookback));
    const rangeLow = Math.min(...lows.slice(-lookback));
    return (rangeHigh - rangeLow) / referencePrice;
  }

  private closePosition(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.entryContractionRange.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.dValues.set(bar.tokenId, []);
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

    if (closes.length > 400) closes.shift();
    if (highs.length > 400) highs.shift();
    if (lows.length > 400) lows.shift();

    const k = this.stochasticK(closes, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 400) kVals.shift();
      const d = this.stochasticD(kVals, this.params.stoch_d_period);
      if (d !== null) {
        dVals.push(d);
        if (dVals.length > 400) dVals.shift();
      }
    }

    const minBars = Math.max(this.params.sr_lookback, this.params.baseline_lookback + this.params.contraction_lookback);
    if (highs.length < minBars || lows.length < minBars) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      const entryContractRange = this.entryContractionRange.get(bar.tokenId);
      if (entry === undefined || entryBarNum === undefined || entryContractRange === undefined) return;

      if (bar.low <= entry * (1 - this.params.stop_loss)) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (bar.high >= entry * (1 + this.params.profit_target)) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (bar.high >= sr.resistance * this.params.resistance_threshold) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      const barsHeld = barNum - entryBarNum;
      if (barsHeld >= this.params.max_hold_bars) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (barsHeld >= this.params.expansion_check_bars) {
        const lookbackBars = this.params.expansion_check_bars + 1;
        if (highs.length >= lookbackBars && lows.length >= lookbackBars) {
          const postEntryHigh = Math.max(...highs.slice(-lookbackBars));
          const postEntryLow = Math.min(...lows.slice(-lookbackBars));
          const postEntryRange = (postEntryHigh - postEntryLow) / Math.max(entry, 1e-9);
          const requiredExpansion = entryContractRange * this.params.expansion_factor;
          if (postEntryRange < requiredExpansion) {
            this.closePosition(ctx, bar.tokenId);
          }
        }
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (kVals.length < 2 || dVals.length < 2 || sr.support <= 0) return;

    const recentRefPrice = closes[closes.length - 1];
    const recentRange = this.normalizedRange(highs, lows, this.params.contraction_lookback, recentRefPrice);
    if (recentRange === null) return;

    const baselineStart = highs.length - this.params.baseline_lookback - this.params.contraction_lookback;
    const baselineEnd = highs.length - this.params.contraction_lookback;
    if (baselineStart < 0 || baselineEnd <= baselineStart) return;
    const baselineHigh = Math.max(...highs.slice(baselineStart, baselineEnd));
    const baselineLow = Math.min(...lows.slice(baselineStart, baselineEnd));
    const baselineRange = (baselineHigh - baselineLow) / Math.max(recentRefPrice, 1e-9);
    if (baselineRange <= 0) return;

    const contractionDetected = recentRange <= baselineRange * this.params.contraction_ratio_threshold;
    if (!contractionDetected) return;

    const prevClose = closes[closes.length - 2];
    const brokeBelowSupport = prevClose < sr.support * (1 - this.params.breakout_buffer);
    const reclaimedSupport = bar.close >= sr.support * (1 + this.params.support_threshold * 0.5);

    const prevK = kVals[kVals.length - 2];
    const currK = kVals[kVals.length - 1];
    const currD = dVals[dVals.length - 1];
    const stochReclaim = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold && currK > currD;

    if (!brokeBelowSupport || !reclaimedSupport || !stochReclaim) return;

    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size > 0 && cash <= ctx.getCapital()) {
      const result = ctx.buy(bar.tokenId, size);
      if (result.success) {
        this.entryPrice.set(bar.tokenId, bar.close);
        this.entryBar.set(bar.tokenId, barNum);
        this.entryContractionRange.set(bar.tokenId, Math.max(recentRange, 1e-6));
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
