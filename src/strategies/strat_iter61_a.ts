import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  supportTouches: number[];
  reservoir: number[];
  prevScore: number | null;
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

function fract(x: number): number {
  return x - Math.floor(x);
}

function deterministicWeight(a: number, b: number, c: number): number {
  const raw = Math.sin((a + 1) * 12.9898 + (b + 1) * 78.233 + (c + 1) * 37.719) * 43758.5453;
  return fract(raw) * 2 - 1;
}

export interface StratIter61AParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  support_touch_lookback: number;
  min_support_touches: number;
  reservoir_size: number;
  input_scale: number;
  recurrent_scale: number;
  leak_rate: number;
  return_lookback: number;
  readout_return_weight: number;
  readout_state_weight: number;
  readout_bias: number;
  entry_threshold: number;
  readout_negative_exit: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter61AStrategy implements Strategy {
  params: StratIter61AParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  private inputWeights: number[] = [];
  private recurrentWeights: number[][] = [];
  private readoutWeights: number[] = [];

  constructor(params: Partial<StratIter61AParams> = {}) {
    const saved = loadSavedParams<StratIter61AParams>('strat_iter61_a.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      support_touch_lookback: 14,
      min_support_touches: 2,
      reservoir_size: 10,
      input_scale: 2.0,
      recurrent_scale: 0.55,
      leak_rate: 0.45,
      return_lookback: 6,
      readout_return_weight: 0.8,
      readout_state_weight: 1.2,
      readout_bias: -0.02,
      entry_threshold: 0.06,
      readout_negative_exit: 0,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter61AParams;

    this.buildReservoir(Math.max(4, Math.floor(this.params.reservoir_size)));
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private buildReservoir(size: number): void {
    this.inputWeights = Array.from({ length: size }, (_, i) => deterministicWeight(i, 7, 61));
    this.readoutWeights = Array.from({ length: size }, (_, i) => deterministicWeight(i, 17, 61));
    this.recurrentWeights = Array.from({ length: size }, (_, i) =>
      Array.from({ length: size }, (_, j) => deterministicWeight(i, j, 161))
    );
  }

  private getTokenState(tokenId: string): TokenState {
    let s = this.state.get(tokenId);
    if (s) return s;

    const size = Math.max(4, Math.floor(this.params.reservoir_size));
    s = {
      closes: [],
      highs: [],
      lows: [],
      returns: [],
      supportTouches: [],
      reservoir: Array.from({ length: size }, () => 0),
      prevScore: null,
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

  private updateReservoir(s: TokenState, inputReturn: number): void {
    const size = s.reservoir.length;
    const inScale = this.params.input_scale;
    const recScale = this.params.recurrent_scale;
    const leak = Math.max(0.05, Math.min(0.95, this.params.leak_rate));

    const prev = s.reservoir.slice();
    for (let i = 0; i < size; i++) {
      let recurrentDrive = 0;
      for (let j = 0; j < size; j++) recurrentDrive += this.recurrentWeights[i][j] * prev[j];
      recurrentDrive = (recurrentDrive / size) * recScale;
      const drive = this.inputWeights[i] * inputReturn * inScale + recurrentDrive;
      const activated = Math.tanh(drive);
      s.reservoir[i] = (1 - leak) * prev[i] + leak * activated;
    }
  }

  private readoutScore(s: TokenState): number {
    const lookback = Math.max(2, Math.floor(this.params.return_lookback));
    const retSlice = s.returns.slice(-lookback);
    const avgRet = retSlice.length > 0 ? retSlice.reduce((acc, v) => acc + v, 0) / retSlice.length : 0;

    let stateProjection = 0;
    for (let i = 0; i < s.reservoir.length; i++) stateProjection += s.reservoir[i] * this.readoutWeights[i];
    stateProjection /= s.reservoir.length;

    return (
      this.params.readout_bias +
      this.params.readout_return_weight * avgRet +
      this.params.readout_state_weight * stateProjection
    );
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (shouldSkipPrice(bar.close)) return;

    const s = this.getTokenState(bar.tokenId);
    s.barNum += 1;

    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;
    const ret = prevClose && prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    capPush(s.returns, ret, 600);

    this.updateReservoir(s, ret);

    const sr = priorSupportResistance(s.highs, s.lows, this.params.sr_lookback);
    if (!sr) return;

    const touchedSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    if (touchedSupport) capPush(s.supportTouches, s.barNum, 200);

    const touchLookback = Math.max(2, Math.floor(this.params.support_touch_lookback));
    const supportTouches = s.supportTouches.filter((b) => s.barNum - b <= touchLookback).length;
    const supportConfirmed =
      touchedSupport &&
      supportTouches >= Math.max(1, Math.floor(this.params.min_support_touches)) &&
      bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);

    const score = this.readoutScore(s);
    const scoreCrossUp = s.prevScore !== null && s.prevScore < this.params.entry_threshold && score >= this.params.entry_threshold;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) {
        s.prevScore = score;
        return;
      }

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = s.barNum - enteredBar >= this.params.max_hold_bars;
      const readoutFlippedNegative = score <= this.params.readout_negative_exit;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || readoutFlippedNegative) {
        this.close(ctx, bar.tokenId);
      }

      s.prevScore = score;
      return;
    }

    if (scoreCrossUp && supportConfirmed) {
      this.open(ctx, bar, s.barNum);
    }

    s.prevScore = score;
  }
}
