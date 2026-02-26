import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter85EParams extends StrategyParams {
  window_size: number;
  min_run_length: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter85EParams = {
  window_size: 30,
  min_run_length: 5,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter85EParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter85_e.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

type RunState = {
  runLength: number;
  wasLongRun: boolean;
  runEnded: boolean;
};

export class StratIter85EStrategy implements Strategy {
  params: StratIter85EParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private runStates: Map<string, RunState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter85EParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter85EParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private rollingMean(values: number[], window: number): number | null {
    if (values.length < window) return null;
    const slice = values.slice(-window);
    return slice.reduce((sum, v) => sum + v, 0) / window;
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

  private supportResistanceFromPriorBars(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
    if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
    const priorHighs = highs.slice(-(lookback + 1), -1);
    const priorLows = lows.slice(-(lookback + 1), -1);
    return {
      support: Math.min(...priorLows),
      resistance: Math.max(...priorHighs),
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.runStates.set(bar.tokenId, { runLength: 0, wasLongRun: false, runEnded: false });
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const runState = this.runStates.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 280) closes.shift();
    if (highs.length > 280) highs.shift();
    if (lows.length > 280) lows.shift();

    const mean = this.rollingMean(closes, this.params.window_size);
    const k = this.stochasticK(closes, highs, lows, 14);
    const sr = this.supportResistanceFromPriorBars(highs, lows, this.params.sr_lookback);

    if (mean !== null) {
      const deviation = bar.close - mean;
      const isNegative = deviation < 0;

      if (isNegative) {
        runState.runLength++;
        runState.runEnded = false;
        if (runState.runLength >= this.params.min_run_length) {
          runState.wasLongRun = true;
        }
      } else {
        if (runState.wasLongRun && runState.runLength >= this.params.min_run_length) {
          runState.runEnded = true;
        }
        runState.runLength = 0;
        runState.wasLongRun = false;
      }
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
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
    if (k === null || sr === null) return;

    const isOversold = k <= this.params.stoch_oversold;
    const runEndedSignal = runState.runEnded;

    if (runEndedSignal && isOversold) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
          runState.runEnded = false;
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
