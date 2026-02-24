import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  crowding: number[];
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

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function sign(x: number): number {
  if (x > 0) return 1;
  if (x < 0) return -1;
  return 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export interface StratIter62DParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  crowding_window: number;
  min_abs_return: number;
  persistence_ratio_weight: number;
  persistence_run_weight: number;
  participation_weight: number;
  extreme_threshold: number;
  unwind_delta: number;
  reextend_delta: number;
  reextend_floor: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter62DStrategy implements Strategy {
  params: StratIter62DParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private entryCrowding: Map<string, number> = new Map();

  constructor(params: Partial<StratIter62DParams> = {}) {
    const saved = loadSavedParams<StratIter62DParams>('strat_iter62_d.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      crowding_window: 20,
      min_abs_return: 0.001,
      persistence_ratio_weight: 0.9,
      persistence_run_weight: 0.9,
      participation_weight: 0.8,
      extreme_threshold: 0.62,
      unwind_delta: 0.03,
      reextend_delta: 0.035,
      reextend_floor: 0.4,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter62DParams;
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
      crowding: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number, crowding: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;

    const result = ctx.buy(bar.tokenId, size);
    if (!result.success) return false;

    this.entryPrice.set(bar.tokenId, bar.close);
    this.entryBar.set(bar.tokenId, barNum);
    this.entryCrowding.set(bar.tokenId, crowding);
    return true;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.entryCrowding.delete(tokenId);
  }

  private crowdingScore(returns: number[]): number {
    const w = Math.max(8, Math.floor(this.params.crowding_window));
    if (returns.length < w + 2) return 0;

    const fast = returns.slice(-w);
    const signs = fast.map((r) => sign(r));

    let nonZero = 0;
    let netSign = 0;
    for (const s of signs) {
      if (s !== 0) {
        nonZero += 1;
        netSign += s;
      }
    }
    if (nonZero === 0) return 0;

    let sameSignPairs = 0;
    let pairCount = 0;
    for (let i = 1; i < signs.length; i++) {
      if (signs[i] === 0 || signs[i - 1] === 0) continue;
      pairCount += 1;
      if (signs[i] === signs[i - 1]) sameSignPairs += 1;
    }

    let runs = 0;
    let runSum = 0;
    let curRun = 0;
    let prev = 0;
    for (const s of signs) {
      if (s === 0) continue;
      if (s === prev) curRun += 1;
      else {
        if (curRun > 0) {
          runSum += curRun;
          runs += 1;
        }
        curRun = 1;
        prev = s;
      }
    }
    if (curRun > 0) {
      runSum += curRun;
      runs += 1;
    }

    const directionalBias = clamp(netSign / nonZero, -1, 1);
    const persistenceRatio = pairCount > 0 ? sameSignPairs / pairCount : 0;
    const avgRun = runs > 0 ? runSum / runs : 1;
    const runPersistence = clamp((avgRun - 1) / Math.max(1, w / 3), 0, 1);

    const absFast = mean(fast.map((r) => Math.abs(r)));
    const absSlow = mean(returns.slice(-(w * 3)).map((r) => Math.abs(r)));
    const participation = absSlow > 0 ? clamp(absFast / absSlow - 1, 0, 2) : 0;

    const intensity =
      this.params.persistence_ratio_weight * persistenceRatio +
      this.params.persistence_run_weight * runPersistence +
      this.params.participation_weight * participation;

    return directionalBias * intensity;
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
    if (Math.abs(ret) >= this.params.min_abs_return) capPush(s.returns, ret, 900);

    const crowding = this.crowdingScore(s.returns);
    const prevCrowding = s.crowding.length > 0 ? s.crowding[s.crowding.length - 1] : crowding;
    capPush(s.crowding, crowding, 900);

    const sr = priorSupportResistance(s.highs, s.lows, this.params.sr_lookback);
    if (!sr) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      const entryCrowd = this.entryCrowding.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined || entryCrowd === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = s.barNum - enteredBar >= this.params.max_hold_bars;

      const crowdingReextends =
        crowding < prevCrowding - this.params.reextend_delta &&
        crowding <= -Math.abs(this.params.reextend_floor) &&
        crowding < entryCrowd;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || crowdingReextends) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);
    const bearishExtreme = prevCrowding <= -Math.abs(this.params.extreme_threshold);
    const unwindStarted = crowding - prevCrowding >= this.params.unwind_delta && crowding > prevCrowding;

    if (nearSupport && supportReclaim && bearishExtreme && unwindStarted) {
      this.open(ctx, bar, s.barNum, crowding);
    }
  }
}
