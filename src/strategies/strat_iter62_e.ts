import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  posCusum: number;
  negCusum: number;
  pendingBull: boolean;
  pendingBear: boolean;
  bullHysteresisStreak: number;
  bearHysteresisStreak: number;
  lastBullConfirmBar: number | null;
  lastBearConfirmBar: number | null;
  barNum: number;
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

function capPush(values: number[], value: number, max = 1200): void {
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

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(Math.max(variance, 0));
}

export interface StratIter62EParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  return_scale_lookback: number;
  cusum_drift: number;
  cusum_threshold: number;
  hysteresis_upper: number;
  hysteresis_lower: number;
  hysteresis_confirm_bars: number;
  signal_max_age: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter62EStrategy implements Strategy {
  params: StratIter62EParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter62EParams> = {}) {
    const saved = loadSavedParams<StratIter62EParams>('strat_iter62_e.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.02,
      support_reclaim_buffer: 0.004,
      return_scale_lookback: 18,
      cusum_drift: 0.04,
      cusum_threshold: 2.2,
      hysteresis_upper: 1.6,
      hysteresis_lower: 0.7,
      hysteresis_confirm_bars: 2,
      signal_max_age: 6,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter62EParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private getState(tokenId: string): TokenState {
    let s = this.state.get(tokenId);
    if (s) return s;

    s = {
      closes: [],
      highs: [],
      lows: [],
      returns: [],
      posCusum: 0,
      negCusum: 0,
      pendingBull: false,
      pendingBear: false,
      bullHysteresisStreak: 0,
      bearHysteresisStreak: 0,
      lastBullConfirmBar: null,
      lastBearConfirmBar: null,
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
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

  private updateCusumAndHysteresis(s: TokenState, normalizedRet: number): { bullConfirmed: boolean; bearConfirmed: boolean } {
    const drift = this.params.cusum_drift;
    const threshold = this.params.cusum_threshold;

    const upShock = normalizedRet - drift;
    const downShock = -normalizedRet - drift;
    s.posCusum = Math.max(0, s.posCusum + upShock);
    s.negCusum = Math.max(0, s.negCusum + downShock);

    if (s.posCusum >= threshold) {
      s.pendingBull = true;
      s.pendingBear = false;
      s.bearHysteresisStreak = 0;
    }
    if (s.negCusum >= threshold) {
      s.pendingBear = true;
      s.pendingBull = false;
      s.bullHysteresisStreak = 0;
    }

    let bullConfirmed = false;
    let bearConfirmed = false;
    const upper = this.params.hysteresis_upper;
    const lower = this.params.hysteresis_lower;
    const need = Math.max(1, Math.floor(this.params.hysteresis_confirm_bars));

    if (s.pendingBull) {
      if (s.posCusum >= upper) {
        s.bullHysteresisStreak += 1;
      } else if (s.posCusum <= lower) {
        s.pendingBull = false;
        s.bullHysteresisStreak = 0;
      }
      if (s.bullHysteresisStreak >= need) {
        bullConfirmed = true;
        s.lastBullConfirmBar = s.barNum;
        s.pendingBull = false;
        s.bullHysteresisStreak = 0;
        s.posCusum = Math.max(0, s.posCusum * 0.4);
      }
    }

    if (s.pendingBear) {
      if (s.negCusum >= upper) {
        s.bearHysteresisStreak += 1;
      } else if (s.negCusum <= lower) {
        s.pendingBear = false;
        s.bearHysteresisStreak = 0;
      }
      if (s.bearHysteresisStreak >= need) {
        bearConfirmed = true;
        s.lastBearConfirmBar = s.barNum;
        s.pendingBear = false;
        s.bearHysteresisStreak = 0;
        s.negCusum = Math.max(0, s.negCusum * 0.4);
      }
    }

    return { bullConfirmed, bearConfirmed };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (shouldSkipPrice(bar.close)) return;

    const s = this.getState(bar.tokenId);
    s.barNum += 1;

    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;
    const ret = prevClose && prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    capPush(s.returns, ret, 800);

    const volLookback = Math.max(5, Math.floor(this.params.return_scale_lookback));
    const recentReturns = s.returns.slice(-volLookback);
    const retScale = Math.max(1e-4, stdDev(recentReturns));
    const normalizedRet = ret / retScale;
    const change = this.updateCusumAndHysteresis(s, normalizedRet);

    const sr = priorSupportResistance(s.highs, s.lows, this.params.sr_lookback);
    if (!sr) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = s.barNum - enteredBar >= this.params.max_hold_bars;
      const oppositeChangePoint = change.bearConfirmed;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || oppositeChangePoint) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const bullishConfirmedRecently =
      s.lastBullConfirmBar !== null &&
      s.barNum - s.lastBullConfirmBar <= Math.max(1, Math.floor(this.params.signal_max_age));

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);

    if (bullishConfirmedRecently && nearSupport && supportReclaim) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
