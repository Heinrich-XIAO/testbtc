import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter149AParams extends StrategyParams {
  volatility_mult: number;
  volatility_window: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter149AParams = {
  volatility_mult: 1.5,
  volatility_window: 20,
  stoch_oversold: 16,
  stop_loss: 0.10,
  profit_target: 0.15,
  max_hold_bars: 25,
  risk_percent: 0.20,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter149AParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter149_a.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter149AStrategy implements Strategy {
  params: StratIter149AParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter149AParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter149AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calcATR(highs: number[], lows: number[], closes: number[], period: number): number | null {
    if (closes.length < period + 1) return null;
    const trs: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
      trs.push(tr);
    }
    if (trs.length < period) return null;
    return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
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
    if (closes.length > 300) closes.shift();
    if (highs.length > 300) highs.shift();
    if (lows.length > 300) lows.shift();

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
    if (closes.length < this.params.volatility_window + 1) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const k = this.stochasticK(closes, highs, lows, 14);
    const atr = this.calcATR(highs, lows, closes, this.params.volatility_window);
    if (!atr) return;

    const avgATR = this.calcATR(highs.slice(0, -this.params.volatility_window), lows.slice(0, -this.params.volatility_window), closes.slice(0, -this.params.volatility_window), this.params.volatility_window);
    if (!avgATR) return;

    const highVolatility = atr > avgATR * this.params.volatility_mult;
    const nearSupport = bar.low <= sr.support * 1.02;
    const stochOversold = k !== null && k < this.params.stoch_oversold;

    if (highVolatility && nearSupport && stochOversold) {
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
