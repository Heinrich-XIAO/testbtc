import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter147BParams extends StrategyParams {
  reversal_threshold: number;
  momentum_window: number;
  quick_profit: number;
  tight_stop: number;
  stoch_oversold: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter147BParams = {
  reversal_threshold: 0.015,
  momentum_window: 5,
  quick_profit: 0.07,
  tight_stop: 0.04,
  stoch_oversold: 18,
  max_hold_bars: 10,
  risk_percent: 0.15,
  sr_lookback: 30,
};

function loadSavedParams(): Partial<StratIter147BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter147_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter147BStrategy implements Strategy {
  params: StratIter147BParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter147BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter147BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calcMomentum(closes: number[], window: number): number | null {
    if (closes.length < window + 1) return null;
    return (closes[closes.length - 1] - closes[closes.length - 1 - window]) / closes[closes.length - 1 - window];
  }

  private detectReversalSignal(closes: number[]): boolean {
    if (closes.length < 3) return false;
    const mom1 = (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2];
    const mom2 = (closes[closes.length - 2] - closes[closes.length - 3]) / closes[closes.length - 3];
    return mom2 < -this.params.reversal_threshold && mom1 > 0;
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

  private supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
    if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
    return {
      support: Math.min(...lows.slice(-(lookback + 1), -1)),
      resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 200) closes.shift();
    if (highs.length > 200) highs.shift();
    if (lows.length > 200) lows.shift();

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.low <= entry * (1 - this.params.tight_stop)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
        if (bar.high >= entry * (1 + this.params.quick_profit)) {
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
    if (closes.length < 14) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const k = this.stochasticK(closes, highs, lows, 14);
    const reversal = this.detectReversalSignal(closes);
    const momentum = this.calcMomentum(closes, this.params.momentum_window);
    const nearSupport = bar.low <= sr.support * 1.01;
    const stochOversold = k !== null && k < this.params.stoch_oversold;

    if (reversal && momentum !== null && momentum > 0 && nearSupport && stochOversold) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
