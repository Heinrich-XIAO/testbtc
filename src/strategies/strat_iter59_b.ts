import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  residuals: number[];
  prevPredictedReturn: number | null;
  prevSurpriseZ: number | null;
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function capPush(values: number[], value: number, max = 900): void {
  values.push(value);
  if (values.length > max) values.shift();
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

export interface StratIter59BParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  ar_window: number;
  ar_last_return_weight: number;
  ar_mean_return_weight: number;
  residual_window: number;
  entry_surprise_z: number;
  reversion_z_delta: number;
  min_rebound_return: number;
  surprise_renew_z: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter59BStrategy implements Strategy {
  params: StratIter59BParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter59BParams> = {}) {
    const saved = loadSavedParams<StratIter59BParams>('strat_iter59_b.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      ar_window: 10,
      ar_last_return_weight: 0.7,
      ar_mean_return_weight: 0.3,
      residual_window: 24,
      entry_surprise_z: 1.6,
      reversion_z_delta: 0.30,
      min_rebound_return: 0.0002,
      surprise_renew_z: 1.15,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter59BParams;
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
      returns: [],
      residuals: [],
      prevPredictedReturn: null,
      prevSurpriseZ: null,
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

  private computeSurpriseZ(residuals: number[]): number | null {
    const w = Math.max(8, Math.floor(this.params.residual_window));
    if (residuals.length < w) return null;

    const window = residuals.slice(-w);
    const residualNow = window[window.length - 1];
    const m = mean(window);
    const sd = Math.max(1e-5, stdDev(window));
    return (residualNow - m) / sd;
  }

  private updatePrediction(tokenState: TokenState): void {
    const w = Math.max(3, Math.floor(this.params.ar_window));
    if (tokenState.returns.length < w) {
      tokenState.prevPredictedReturn = null;
      return;
    }

    const returnWindow = tokenState.returns.slice(-w);
    const lastReturn = returnWindow[returnWindow.length - 1];
    const avgReturn = mean(returnWindow);

    const lastWeight = clamp(this.params.ar_last_return_weight, 0, 1.5);
    const meanWeight = clamp(this.params.ar_mean_return_weight, 0, 1.5);
    const predicted = lastWeight * lastReturn + meanWeight * avgReturn;

    tokenState.prevPredictedReturn = clamp(predicted, -0.25, 0.25);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (shouldSkipPrice(bar.close)) return;

    const tokenState = this.getState(bar.tokenId);
    tokenState.barNum += 1;

    const prevClose = tokenState.closes.length > 0 ? tokenState.closes[tokenState.closes.length - 1] : null;
    const realizedReturn = prevClose && prevClose > 0 ? (bar.close - prevClose) / prevClose : null;

    if (realizedReturn !== null && tokenState.prevPredictedReturn !== null) {
      const residual = realizedReturn - tokenState.prevPredictedReturn;
      capPush(tokenState.residuals, residual);
    }

    capPush(tokenState.closes, bar.close);
    capPush(tokenState.highs, bar.high);
    capPush(tokenState.lows, bar.low);
    if (realizedReturn !== null) {
      capPush(tokenState.returns, realizedReturn);
    }

    const sr = priorSupportResistance(tokenState.highs, tokenState.lows, this.params.sr_lookback);
    const surpriseZ = this.computeSurpriseZ(tokenState.residuals);
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0 && sr) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && enteredBar !== undefined) {
        const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
        const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
        const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
        const maxHoldReached = tokenState.barNum - enteredBar >= this.params.max_hold_bars;
        const surpriseRenewed = surpriseZ !== null && surpriseZ <= -Math.abs(this.params.surprise_renew_z);

        if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || surpriseRenewed) {
          this.close(ctx, bar.tokenId);
        }
      }
    } else if (!pos || pos.size <= 0) {
      if (sr && surpriseZ !== null && realizedReturn !== null) {
        const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
        const supportReclaim = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);
        const overshootDown = surpriseZ <= -Math.abs(this.params.entry_surprise_z);

        const prevSurpriseZ = tokenState.prevSurpriseZ;
        const zIsReverting = prevSurpriseZ === null || surpriseZ - prevSurpriseZ >= this.params.reversion_z_delta;
        const reboundNow = realizedReturn >= this.params.min_rebound_return;

        if (nearSupport && supportReclaim && overshootDown && (zIsReverting || reboundNow)) {
          this.open(ctx, bar, tokenState.barNum);
        }
      }
    }

    tokenState.prevSurpriseZ = surpriseZ;
    this.updatePrediction(tokenState);
  }
}
