import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter151DParams extends StrategyParams {
  lp_period: number;
  lp_alpha: number;
  stoch_period: number;
  stoch_oversold: number;
  breakout_threshold: number;
  sr_lookback: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter151DParams = {
  lp_period: 12,
  lp_alpha: 0.15,
  stoch_period: 14,
  stoch_oversold: 16,
  breakout_threshold: 0.006,
  sr_lookback: 50,
  stop_loss: 0.08,
  profit_target: 0.16,
  max_hold_bars: 28,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter151DParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter151_d.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter151DStrategy implements Strategy {
  params: StratIter151DParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private smoothed: Map<string, number[]> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter151DParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter151DParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private lowpassFilter(values: number[], alpha: number): number[] {
    if (values.length < 2) return values;
    const smoothed: number[] = [values[0]];
    for (let i = 1; i < values.length; i++) {
      smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
    }
    return smoothed;
  }

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period) return null;
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
  }

  private supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
    if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
    return {
      support: Math.min(...lows.slice(-(lookback + 1), -1)),
      resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.smoothed.set(bar.tokenId, []);
      this.kVals.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const smoothed = this.smoothed.get(bar.tokenId)!;
    const kVals = this.kVals.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 300) closes.shift();
    if (highs.length > 300) highs.shift();
    if (lows.length > 300) lows.shift();

    const lp = this.lowpassFilter(closes, this.params.lp_alpha);
    if (lp.length > 0) {
      smoothed.push(lp[lp.length - 1]);
      if (smoothed.length > 300) smoothed.shift();
    }

    const k = this.stochasticK(closes, highs, lows, this.params.stoch_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 300) kVals.shift();
    }

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
        const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
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
        if (sr && bar.high >= sr.resistance * 0.98) {
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
    if (closes.length < this.params.lp_period + 2 || smoothed.length < 2 || kVals.length < 2) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const prevSmoothed = smoothed[smoothed.length - 2];
    const currSmoothed = smoothed[smoothed.length - 1];
    const breakout = bar.close >= prevSmoothed * (1 + this.params.breakout_threshold);
    const aboveSmooth = bar.close > currSmoothed;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kVals[kVals.length - 2] < this.params.stoch_oversold && kVals[kVals.length - 1] >= this.params.stoch_oversold;

    if (breakout && aboveSmooth && nearSupport && stochRecover) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
