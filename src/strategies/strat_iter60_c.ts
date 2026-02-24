import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TransitionSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  states: number[];
};

type ScenarioUtility = {
  expected: number;
  up: number;
  flat: number;
  down: number;
};

const STATE_DOWN = -1;
const STATE_FLAT = 0;
const STATE_UP = 1;

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

function classifyState(ret: number, upThreshold: number, downThreshold: number): number {
  if (ret >= upThreshold) return STATE_UP;
  if (ret <= -downThreshold) return STATE_DOWN;
  return STATE_FLAT;
}

export interface StratIter60CParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_hold_buffer: number;
  transition_lookback: number;
  state_up_threshold: number;
  state_down_threshold: number;
  min_transition_samples: number;
  utility_positive_threshold: number;
  utility_negative_threshold: number;
  downside_penalty: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter60CStrategy implements Strategy {
  params: StratIter60CParams;

  private series: Map<string, TransitionSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter60CParams> = {}) {
    const saved = loadSavedParams<StratIter60CParams>('strat_iter60_c.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.016,
      support_hold_buffer: 0.006,
      transition_lookback: 70,
      state_up_threshold: 0.006,
      state_down_threshold: 0.006,
      min_transition_samples: 10,
      utility_positive_threshold: 0.0015,
      utility_negative_threshold: -0.0007,
      downside_penalty: 1.3,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter60CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TransitionSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [], states: [] });
      this.bars.set(bar.tokenId, 0);
    }

    const s = this.series.get(bar.tokenId)!;
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    if (prevClose !== null && prevClose > 0) {
      const ret = (bar.close - prevClose) / prevClose;
      capPush(s.returns, ret);
      const state = classifyState(
        ret,
        Math.max(0.0005, this.params.state_up_threshold),
        Math.max(0.0005, this.params.state_down_threshold)
      );
      capPush(s.states, state);
    }

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private computeScenarioUtility(series: TransitionSeries): ScenarioUtility | null {
    const lookback = Math.max(12, Math.floor(this.params.transition_lookback));
    if (series.states.length < lookback + 1 || series.returns.length < lookback + 1) return null;

    const states = series.states.slice(-(lookback + 1));
    const rets = series.returns.slice(-(lookback + 1));
    const currentState = states[states.length - 1];

    let rowTransitions = 0;
    let upCount = 0;
    let flatCount = 0;
    let downCount = 0;

    let upRetSum = 0;
    let flatRetSum = 0;
    let downRetSum = 0;

    for (let i = 0; i < states.length - 1; i++) {
      const fromState = states[i];
      const toState = states[i + 1];
      if (fromState !== currentState) continue;

      rowTransitions++;
      const nextRet = rets[i + 1];
      if (toState === STATE_UP) {
        upCount++;
        upRetSum += nextRet;
      } else if (toState === STATE_DOWN) {
        downCount++;
        downRetSum += nextRet;
      } else {
        flatCount++;
        flatRetSum += nextRet;
      }
    }

    if (rowTransitions < Math.max(1, Math.floor(this.params.min_transition_samples))) return null;

    const pUp = upCount / rowTransitions;
    const pFlat = flatCount / rowTransitions;
    const pDown = downCount / rowTransitions;

    const globalUpMean = upCount > 0 ? upRetSum / upCount : Math.max(0.0002, this.params.state_up_threshold * 0.7);
    const globalFlatMean = flatCount > 0 ? flatRetSum / flatCount : 0;
    const globalDownMean = downCount > 0 ? downRetSum / downCount : -Math.max(0.0002, this.params.state_down_threshold * 0.7);

    const upUtility = globalUpMean;
    const flatUtility = globalFlatMean;
    const downUtility = globalDownMean * Math.max(1, this.params.downside_penalty);

    const expected = pUp * upUtility + pFlat * flatUtility + pDown * downUtility;
    return {
      expected,
      up: upUtility,
      flat: flatUtility,
      down: downUtility,
    };
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

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (shouldSkipPrice(bar.close)) return;

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const utility = this.computeScenarioUtility(series);
    if (!sr || !utility) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
      const utilityTurnedNegative = utility.expected <= this.params.utility_negative_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || utilityTurnedNegative) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const supportRetest = bar.low <= sr.support * (1 + this.params.support_buffer);
    const supportHeld = bar.close >= sr.support * (1 - this.params.support_hold_buffer);
    const utilityStrongPositive = utility.expected >= this.params.utility_positive_threshold;

    if (supportRetest && supportHeld && utilityStrongPositive) {
      this.open(ctx, bar, barNum);
    }
  }
}
