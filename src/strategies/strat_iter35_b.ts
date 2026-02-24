import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter35BParams extends StrategyParams {
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  support_threshold: number;
  resistance_threshold: number;
  sr_lookback: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  breakeven_trigger: number;
  breakeven_buffer: number;
  risk_percent: number;
}

const defaultParams: StratIter35BParams = {
  stoch_k_period: 14,
  stoch_d_period: 3,
  stoch_oversold: 18,
  support_threshold: 0.01,
  resistance_threshold: 0.98,
  sr_lookback: 50,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  breakeven_trigger: 0.08,
  breakeven_buffer: 0.005,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter35BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter35_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter35BStrategy implements Strategy {
  params: StratIter35BParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private dValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private promotedStop: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter35BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter35BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period || highs.length < period || lows.length < period) return null;
    const windowHigh = Math.max(...highs.slice(-period));
    const windowLow = Math.min(...lows.slice(-period));
    if (windowHigh === windowLow) return 50;
    return ((closes[closes.length - 1] - windowLow) / (windowHigh - windowLow)) * 100;
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

  private clearPositionTracking(tokenId: string): void {
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.promotedStop.delete(tokenId);
  }

  private closePosition(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.clearPositionTracking(tokenId);
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

    if (closes.length > 320) closes.shift();
    if (highs.length > 320) highs.shift();
    if (lows.length > 320) lows.shift();

    const k = this.stochasticK(closes, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 320) kVals.shift();
      const d = this.stochasticD(kVals, this.params.stoch_d_period);
      if (d !== null) {
        dVals.push(d);
        if (dVals.length > 320) dVals.shift();
      }
    }

    const sr = this.supportResistanceFromPriorBars(highs, lows, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBarNum === undefined) return;

      let activeStop = this.promotedStop.get(bar.tokenId) ?? entry * (1 - this.params.stop_loss);

      const beTriggerPrice = entry * (1 + this.params.breakeven_trigger);
      if (bar.high >= beTriggerPrice) {
        const breakEvenStop = entry * (1 + this.params.breakeven_buffer);
        if (breakEvenStop > activeStop) {
          activeStop = breakEvenStop;
          this.promotedStop.set(bar.tokenId, activeStop);
        }
      }

      if (bar.low <= activeStop) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (bar.high >= entry * (1 + this.params.profit_target)) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (sr && bar.high >= sr.resistance * this.params.resistance_threshold) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (barNum - entryBarNum >= this.params.max_hold_bars) {
        this.closePosition(ctx, bar.tokenId);
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (!sr || sr.support <= 0) return;
    if (kVals.length < 2 || dVals.length < 2) return;

    const prevK = kVals[kVals.length - 2];
    const currK = kVals[kVals.length - 1];
    const prevD = dVals[dVals.length - 2];
    const currD = dVals[dVals.length - 1];

    const stochCrossUp = prevK <= prevD && currK > currD;
    const crossedFromOversold = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_threshold);

    if (stochCrossUp && crossedFromOversold && nearSupport) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
          this.promotedStop.delete(bar.tokenId);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
