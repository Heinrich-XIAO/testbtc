import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type Regime = 'stable' | 'unstable' | 'neutral';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  momentum: number[];
  logistic: number[];
  lyapunov: number[];
  regime: Regime;
  lastStableToUnstableBar: number | null;
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

export interface StratIter61BParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  bifurcation_window: number;
  momentum_scale: number;
  logistic_r_base: number;
  logistic_r_momentum_gain: number;
  logistic_r_accel_gain: number;
  stable_var_max: number;
  unstable_var_min: number;
  stable_lyap_max: number;
  unstable_lyap_min: number;
  max_flip_age: number;
  pullback_momentum_min: number;
  min_momentum_rebound: number;
  min_logistic_rebound: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter61BStrategy implements Strategy {
  params: StratIter61BParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter61BParams> = {}) {
    const saved = loadSavedParams<StratIter61BParams>('strat_iter61_b.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      bifurcation_window: 22,
      momentum_scale: 0.015,
      logistic_r_base: 2.9,
      logistic_r_momentum_gain: 1.7,
      logistic_r_accel_gain: 1.0,
      stable_var_max: 0.012,
      unstable_var_min: 0.022,
      stable_lyap_max: -0.03,
      unstable_lyap_min: 0.01,
      max_flip_age: 5,
      pullback_momentum_min: 0.004,
      min_momentum_rebound: 0.001,
      min_logistic_rebound: 0.015,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter61BParams;
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
      momentum: [],
      logistic: [],
      lyapunov: [],
      regime: 'neutral',
      lastStableToUnstableBar: null,
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

  private updateBifurcationState(tokenState: TokenState, close: number): Regime {
    const prevClose = tokenState.closes.length > 0 ? tokenState.closes[tokenState.closes.length - 1] : null;
    const mom = prevClose && prevClose > 0 ? (close - prevClose) / prevClose : 0;
    capPush(tokenState.momentum, mom);

    const mScale = Math.max(0.001, this.params.momentum_scale);
    const normalizedMom = clamp(0.5 + 0.5 * Math.tanh(mom / mScale), 0.001, 0.999);
    const prevMom = tokenState.momentum.length > 1 ? tokenState.momentum[tokenState.momentum.length - 2] : mom;
    const momAccel = Math.abs(mom - prevMom);

    const r = clamp(
      this.params.logistic_r_base +
        this.params.logistic_r_momentum_gain * Math.abs(normalizedMom - 0.5) * 2 +
        this.params.logistic_r_accel_gain * Math.min(1, momAccel / mScale),
      2.6,
      3.99
    );

    const prevX = tokenState.logistic.length > 0 ? tokenState.logistic[tokenState.logistic.length - 1] : normalizedMom;
    const x = clamp(r * prevX * (1 - prevX), 0.000001, 0.999999);
    capPush(tokenState.logistic, x);

    const lyap = Math.log(Math.max(1e-6, Math.abs(r * (1 - 2 * x))));
    capPush(tokenState.lyapunov, lyap);

    const w = Math.max(10, Math.floor(this.params.bifurcation_window));
    if (tokenState.logistic.length < w || tokenState.lyapunov.length < w) return 'neutral';

    const xWindow = tokenState.logistic.slice(-w);
    const lWindow = tokenState.lyapunov.slice(-w);
    const xVar = Math.pow(stdDev(xWindow), 2);
    const lyapAvg = mean(lWindow);

    const stable = xVar <= this.params.stable_var_max && lyapAvg <= this.params.stable_lyap_max;
    const unstable = xVar >= this.params.unstable_var_min || lyapAvg >= this.params.unstable_lyap_min;
    if (stable) return 'stable';
    if (unstable) return 'unstable';
    return 'neutral';
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (shouldSkipPrice(bar.close)) return;

    const tokenState = this.getState(bar.tokenId);
    tokenState.barNum += 1;

    const prevRegime = tokenState.regime;
    const regime = this.updateBifurcationState(tokenState, bar.close);
    tokenState.regime = regime;

    if (prevRegime === 'stable' && regime === 'unstable') {
      tokenState.lastStableToUnstableBar = tokenState.barNum;
    }

    capPush(tokenState.closes, bar.close);
    capPush(tokenState.highs, bar.high);
    capPush(tokenState.lows, bar.low);

    const sr = priorSupportResistance(tokenState.highs, tokenState.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0 && sr) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && enteredBar !== undefined) {
        const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
        const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
        const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
        const maxHoldReached = tokenState.barNum - enteredBar >= this.params.max_hold_bars;
        const regimeReversed = regime === 'stable';

        if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || regimeReversed) {
          this.close(ctx, bar.tokenId);
        }
      }
      return;
    }

    if (!sr) return;
    const flipBar = tokenState.lastStableToUnstableBar;
    if (flipBar === null) return;

    const flipFresh = tokenState.barNum - flipBar <= Math.max(1, Math.floor(this.params.max_flip_age));
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);

    const n = tokenState.momentum.length;
    const momNow = n > 0 ? tokenState.momentum[n - 1] : 0;
    const momPrev = n > 1 ? tokenState.momentum[n - 2] : momNow;
    const momentumRebound = momNow - momPrev >= this.params.min_momentum_rebound;
    const pullbackSeen = momPrev <= -Math.abs(this.params.pullback_momentum_min);

    const lx = tokenState.logistic.length;
    const xNow = lx > 0 ? tokenState.logistic[lx - 1] : 0;
    const xPrev = lx > 1 ? tokenState.logistic[lx - 2] : xNow;
    const logisticRebound = xNow - xPrev >= this.params.min_logistic_rebound;

    if (flipFresh && nearSupport && supportReclaim && pullbackSeen && (momentumRebound || logisticRebound)) {
      this.open(ctx, bar, tokenState.barNum);
    }
  }
}
