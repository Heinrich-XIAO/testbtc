import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter152DParams extends StrategyParams {
  igarch_lookback: number;
  variance_threshold: number;
  momentum_lookback: number;
  momentum_threshold: number;
  stoch_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter152DParams = {
  igarch_lookback: 24,
  variance_threshold: 2.5,
  momentum_lookback: 8,
  momentum_threshold: 0.008,
  stoch_period: 14,
  stoch_oversold: 16,
  stoch_overbought: 84,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 24,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter152DParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter152_d.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter152DStrategy implements Strategy {
  params: StratIter152DParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private returns: Map<string, number[]> = new Map();
  private squaredReturns: Map<string, number[]> = new Map();
  private igarchVariance: Map<string, number[]> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter152DParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter152DParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private computeIGARCHVariance(returns: number[], squaredReturns: number[], lookback: number): number | null {
    if (returns.length < lookback + 1 || squaredReturns.length < lookback + 1) return null;
    
    const recentSqReturns = squaredReturns.slice(-(lookback + 1));
    const recentReturns = returns.slice(-(lookback + 1));
    
    let variance = recentSqReturns[0];
    for (let i = 1; i < recentSqReturns.length; i++) {
      variance = recentSqReturns[i] + variance;
    }
    
    const avgVariance = recentSqReturns.reduce((a, b) => a + b, 0) / recentSqReturns.length;
    
    return variance / avgVariance;
  }

  private momentum(closes: number[], lookback: number): number | null {
    if (closes.length < lookback + 1) return null;
    const recent = closes.slice(-(lookback + 1));
    return (recent[recent.length - 1] - recent[0]) / recent[0];
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

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.returns.set(bar.tokenId, []);
      this.squaredReturns.set(bar.tokenId, []);
      this.igarchVariance.set(bar.tokenId, []);
      this.kVals.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const returns = this.returns.get(bar.tokenId)!;
    const squaredReturns = this.squaredReturns.get(bar.tokenId)!;
    const igarchVariance = this.igarchVariance.get(bar.tokenId)!;
    const kVals = this.kVals.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);

    if (closes.length > 1) {
      const ret = (closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2];
      returns.push(ret);
      squaredReturns.push(ret * ret);
    }

    if (closes.length > 200) closes.shift();
    if (highs.length > 200) highs.shift();
    if (lows.length > 200) lows.shift();
    if (returns.length > 200) returns.shift();
    if (squaredReturns.length > 200) squaredReturns.shift();

    const igarch = this.computeIGARCHVariance(returns, squaredReturns, this.params.igarch_lookback);
    if (igarch !== null) {
      igarchVariance.push(igarch);
      if (igarchVariance.length > 200) igarchVariance.shift();
    }

    const k = this.stochasticK(closes, highs, lows, this.params.stoch_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 200) kVals.shift();
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
    if (closes.length < this.params.igarch_lookback + 2 || igarchVariance.length < 2 || kVals.length < 2) return;

    const prevIgarch = igarchVariance[igarchVariance.length - 2];
    const currIgarch = igarchVariance[igarchVariance.length - 1];
    const varianceExploding = currIgarch > this.params.variance_threshold;
    const varianceRising = currIgarch > prevIgarch;

    const mom = this.momentum(closes, this.params.momentum_lookback);
    if (mom === null) return;
    const momentumOk = Math.abs(mom) > this.params.momentum_threshold;

    const prevK = kVals[kVals.length - 2];
    const currK = kVals[kVals.length - 1];
    const stochOversold = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
    const notOverbought = currK < this.params.stoch_overbought;

    if (varianceExploding && varianceRising && momentumOk && stochOversold && notOverbought) {
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
