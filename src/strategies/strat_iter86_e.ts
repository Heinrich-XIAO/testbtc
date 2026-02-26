import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter86EParams extends StrategyParams {
  window_size: number;
  jump_threshold: number;
  min_jump_size: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter86EParams = {
  window_size: 30,
  jump_threshold: 2.5,
  min_jump_size: 0.03,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter86EParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter86_e.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

type JumpState = {
  recentNegativeJump: boolean;
  jumpSize: number;
  barsSinceJump: number;
};

export class StratIter86EStrategy implements Strategy {
  params: StratIter86EParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private jumpStates: Map<string, JumpState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter86EParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter86EParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calcReturns(closes: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    return returns;
  }

  private localStdDev(returns: number[], window: number): number | null {
    if (returns.length < window) return null;
    const slice = returns.slice(-window);
    const mean = slice.reduce((sum, r) => sum + r, 0) / window;
    const variance = slice.reduce((sum, r) => sum + (r - mean) ** 2, 0) / window;
    return Math.sqrt(variance);
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
      this.jumpStates.set(bar.tokenId, { recentNegativeJump: false, jumpSize: 0, barsSinceJump: 0 });
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const jumpState = this.jumpStates.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 280) closes.shift();
    if (highs.length > 280) highs.shift();
    if (lows.length > 280) lows.shift();

    const returns = this.calcReturns(closes);
    const localStd = this.localStdDev(returns, this.params.window_size);
    const k = this.stochasticK(closes, highs, lows, 14);
    const sr = this.supportResistanceFromPriorBars(highs, lows, this.params.sr_lookback);

    if (returns.length > 0 && localStd !== null) {
      const lastReturn = returns[returns.length - 1];
      const jumpThreshold = this.params.jump_threshold * localStd;
      
      if (Math.abs(lastReturn) > jumpThreshold) {
        if (lastReturn < -this.params.min_jump_size) {
          jumpState.recentNegativeJump = true;
          jumpState.jumpSize = lastReturn;
          jumpState.barsSinceJump = 0;
        }
      } else {
        jumpState.barsSinceJump++;
        if (jumpState.barsSinceJump > 5) {
          jumpState.recentNegativeJump = false;
        }
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
    const jumpSignal = jumpState.recentNegativeJump && Math.abs(jumpState.jumpSize) >= this.params.min_jump_size;

    if (jumpSignal && isOversold) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
          jumpState.recentNegativeJump = false;
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
