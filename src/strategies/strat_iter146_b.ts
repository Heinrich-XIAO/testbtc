import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter146BParams extends StrategyParams {
  monthly_ma_period: number;
  bias_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter146BParams = {
  monthly_ma_period: 720,
  bias_threshold: 0.03,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.22,
  max_hold_bars: 72,
  risk_percent: 0.25,
  sr_lookback: 120,
};

function loadSavedParams(): Partial<StratIter146BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter146_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter146BStrategy implements Strategy {
  params: StratIter146BParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter146BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter146BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calcEMA(closes: number[], period: number): number | null {
    if (closes.length < period) return null;
    const multiplier = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
      ema = (closes[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  private calcMonthlyBias(closes: number[], monthlyPeriod: number): { bias: number; strength: number } | null {
    const monthlyEMA = this.calcEMA(closes, monthlyPeriod);
    if (monthlyEMA === null) return null;
    const currentPrice = closes[closes.length - 1];
    const bias = (currentPrice - monthlyEMA) / monthlyEMA;
    const shortEMA = this.calcEMA(closes, Math.floor(monthlyPeriod / 4));
    const strength = shortEMA !== null ? (shortEMA - monthlyEMA) / monthlyEMA : 0;
    return { bias, strength };
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
    if (closes.length > 800) closes.shift();
    if (highs.length > 800) highs.shift();
    if (lows.length > 800) lows.shift();

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
    if (closes.length < this.params.monthly_ma_period) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const monthlyBias = this.calcMonthlyBias(closes, this.params.monthly_ma_period);
    if (!monthlyBias) return;

    const k = this.stochasticK(closes, highs, lows, 14);

    const bullishBias = monthlyBias.bias > this.params.bias_threshold && monthlyBias.strength > 0;
    const nearSupport = bar.low <= sr.support * 1.025;
    const stochOversold = k !== null && k < this.params.stoch_oversold;

    if (bullishBias && nearSupport && stochOversold) {
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
