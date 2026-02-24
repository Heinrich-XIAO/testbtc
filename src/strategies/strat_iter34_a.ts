import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter34AParams extends StrategyParams {
  donchian_breakout_lookback: number;
  donchian_resistance_lookback: number;
  breakout_buffer: number;
  retest_tolerance: number;
  retest_window_bars: number;
  breakout_fail_pct: number;
  resistance_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter34AParams = {
  donchian_breakout_lookback: 12,
  donchian_resistance_lookback: 50,
  breakout_buffer: 0.002,
  retest_tolerance: 0.01,
  retest_window_bars: 6,
  breakout_fail_pct: 0.015,
  resistance_threshold: 0.985,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter34AParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter34_a.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

type BreakoutState = {
  breakoutLevel: number;
  breakoutBar: number;
};

export class StratIter34AStrategy implements Strategy {
  params: StratIter34AParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private barCount: Map<string, number> = new Map();
  private breakoutState: Map<string, BreakoutState | null> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter34AParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter34AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private donchianFromPriorBars(highs: number[], lows: number[], lookback: number): { high: number; low: number } | null {
    if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
    const priorHighs = highs.slice(-(lookback + 1), -1);
    const priorLows = lows.slice(-(lookback + 1), -1);
    return {
      high: Math.max(...priorHighs),
      low: Math.min(...priorLows),
    };
  }

  private clearPositionTracking(tokenId: string): void {
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
      this.breakoutState.set(bar.tokenId, null);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 320) closes.shift();
    if (highs.length > 320) highs.shift();
    if (lows.length > 320) lows.shift();

    const breakoutChannel = this.donchianFromPriorBars(highs, lows, this.params.donchian_breakout_lookback);
    const resistanceChannel = this.donchianFromPriorBars(highs, lows, this.params.donchian_resistance_lookback);

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBarNum === undefined) return;

      if (bar.low <= entry * (1 - this.params.stop_loss)) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
        return;
      }

      if (bar.high >= entry * (1 + this.params.profit_target)) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
        return;
      }

      if (resistanceChannel && bar.high >= resistanceChannel.high * this.params.resistance_threshold) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
        return;
      }

      if (barNum - entryBarNum >= this.params.max_hold_bars) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (!breakoutChannel) return;

    let state = this.breakoutState.get(bar.tokenId) ?? null;

    if (state) {
      const barsSinceBreakout = barNum - state.breakoutBar;
      const failedBreakout = bar.close < state.breakoutLevel * (1 - this.params.breakout_fail_pct);
      if (barsSinceBreakout > this.params.retest_window_bars || failedBreakout) {
        state = null;
        this.breakoutState.set(bar.tokenId, null);
      }
    }

    if (!state) {
      const didBreakout = bar.close > breakoutChannel.high * (1 + this.params.breakout_buffer);
      if (didBreakout) {
        this.breakoutState.set(bar.tokenId, {
          breakoutLevel: breakoutChannel.high,
          breakoutBar: barNum,
        });
      }
      return;
    }

    if (barNum <= state.breakoutBar) return;

    const retestFloor = state.breakoutLevel * (1 - this.params.retest_tolerance);
    const retestCeil = state.breakoutLevel * (1 + this.params.retest_tolerance);
    const touchedRetestZone = bar.low <= retestCeil && bar.high >= retestFloor;
    const closedBackAboveLevel = bar.close >= state.breakoutLevel;

    if (!touchedRetestZone || !closedBackAboveLevel) return;

    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size > 0 && cash <= ctx.getCapital()) {
      const result = ctx.buy(bar.tokenId, size);
      if (result.success) {
        this.entryPrice.set(bar.tokenId, bar.close);
        this.entryBar.set(bar.tokenId, barNum);
        this.breakoutState.set(bar.tokenId, null);
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
