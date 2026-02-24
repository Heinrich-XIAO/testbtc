import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  residuals: number[];
  level: number | null;
  trend: number;
  residualVar: number;
  prevResidualZ: number | null;
  positiveResidualStreak: number;
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

function capPush(values: number[], value: number, max = 900): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) * (v - m)));
  return Math.sqrt(Math.max(0, variance));
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

export interface StratIter60BParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  kalman_process_var: number;
  kalman_trend_gain: number;
  kalman_gain_floor: number;
  kalman_gain_ceiling: number;
  residual_var_alpha: number;
  residual_window: number;
  entry_negative_z: number;
  rebound_z_delta: number;
  min_rebound_return: number;
  inversion_positive_z: number;
  inversion_persist_bars: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter60BStrategy implements Strategy {
  params: StratIter60BParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter60BParams> = {}) {
    const saved = loadSavedParams<StratIter60BParams>('strat_iter60_b.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.02,
      support_reclaim_buffer: 0.004,
      kalman_process_var: 0.001,
      kalman_trend_gain: 0.18,
      kalman_gain_floor: 0.08,
      kalman_gain_ceiling: 0.65,
      residual_var_alpha: 0.08,
      residual_window: 24,
      entry_negative_z: 1.4,
      rebound_z_delta: 0.25,
      min_rebound_return: 0.0002,
      inversion_positive_z: 0.85,
      inversion_persist_bars: 3,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter60BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private getState(tokenId: string): TokenState {
    let tokenState = this.state.get(tokenId);
    if (tokenState) return tokenState;

    tokenState = {
      closes: [],
      highs: [],
      lows: [],
      residuals: [],
      level: null,
      trend: 0,
      residualVar: 1e-4,
      prevResidualZ: null,
      positiveResidualStreak: 0,
      barNum: 0,
    };
    this.state.set(tokenId, tokenState);
    return tokenState;
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

  private updateAdaptiveFilter(tokenState: TokenState, close: number): number {
    if (tokenState.level === null) {
      tokenState.level = close;
      tokenState.trend = 0;
      return 0;
    }

    const predicted = tokenState.level + tokenState.trend;
    const residual = close - predicted;

    const residualSq = residual * residual;
    const alpha = clamp(this.params.residual_var_alpha, 0.01, 0.5);
    tokenState.residualVar = alpha * residualSq + (1 - alpha) * tokenState.residualVar;

    const processVar = Math.max(1e-7, this.params.kalman_process_var);
    const gainRaw = processVar / (processVar + tokenState.residualVar);
    const gain = clamp(gainRaw, this.params.kalman_gain_floor, this.params.kalman_gain_ceiling);
    const trendGain = clamp(this.params.kalman_trend_gain, 0.01, 1.2);

    tokenState.level = predicted + gain * residual;
    tokenState.trend = tokenState.trend + trendGain * gain * residual;

    return residual;
  }

  private residualZ(tokenState: TokenState): number | null {
    const w = Math.max(10, Math.floor(this.params.residual_window));
    if (tokenState.residuals.length < w) return null;

    const window = tokenState.residuals.slice(-w);
    const now = window[window.length - 1];
    const m = mean(window);
    const sd = Math.max(1e-5, stdDev(window));
    return (now - m) / sd;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (shouldSkipPrice(bar.close)) return;

    const tokenState = this.getState(bar.tokenId);
    tokenState.barNum += 1;

    const prevClose = tokenState.closes.length > 0 ? tokenState.closes[tokenState.closes.length - 1] : null;
    const realizedReturn = prevClose && prevClose > 0 ? (bar.close - prevClose) / prevClose : null;

    const residual = this.updateAdaptiveFilter(tokenState, bar.close);
    capPush(tokenState.residuals, residual);
    capPush(tokenState.closes, bar.close);
    capPush(tokenState.highs, bar.high);
    capPush(tokenState.lows, bar.low);

    const sr = priorSupportResistance(tokenState.highs, tokenState.lows, this.params.sr_lookback);
    const residualZ = this.residualZ(tokenState);
    const pos = ctx.getPosition(bar.tokenId);

    if (residualZ !== null && residualZ >= this.params.inversion_positive_z) {
      tokenState.positiveResidualStreak += 1;
    } else {
      tokenState.positiveResidualStreak = 0;
    }

    if (pos && pos.size > 0 && sr) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && enteredBar !== undefined) {
        const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
        const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
        const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
        const maxHoldReached = tokenState.barNum - enteredBar >= this.params.max_hold_bars;
        const inversionPersisted = tokenState.positiveResidualStreak >= Math.max(1, Math.floor(this.params.inversion_persist_bars));

        if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || inversionPersisted) {
          this.close(ctx, bar.tokenId);
        }
      }
    } else if (!pos || pos.size <= 0) {
      if (sr && residualZ !== null && realizedReturn !== null) {
        const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
        const supportReclaim = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);
        const underpricedResidual = residualZ <= -Math.abs(this.params.entry_negative_z);

        const prevZ = tokenState.prevResidualZ;
        const zRebound = prevZ === null || residualZ - prevZ >= this.params.rebound_z_delta;
        const returnRebound = realizedReturn >= this.params.min_rebound_return;

        if (nearSupport && supportReclaim && underpricedResidual && (zRebound || returnRebound)) {
          this.open(ctx, bar, tokenState.barNum);
        }
      }
    }

    tokenState.prevResidualZ = residualZ;
  }
}
