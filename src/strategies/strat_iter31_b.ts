import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter31BParams extends StrategyParams {
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  bollinger_period: number;
  bollinger_std_dev: number;
}

const defaultParams: StratIter31BParams = {
  stoch_k_period: 14,
  stoch_d_period: 3,
  stoch_oversold: 20,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 32,
  risk_percent: 0.25,
  bollinger_period: 20,
  bollinger_std_dev: 2,
};

function loadSavedParams(): Partial<StratIter31BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter31_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StratIter31BStrategy implements Strategy {
  params: StratIter31BParams;
  private priceHistory: Map<string, number[]> = new Map();
  private highHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private dValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter31BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter31BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateBollinger(history: number[], period: number, stdDev: number) {
    if (history.length < period) return null;
    const slice = history.slice(-period);
    const mean = slice.reduce((sum, price) => sum + price, 0) / period;
    const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
    const deviation = Math.sqrt(variance);
    return {
      middle: mean,
      upper: mean + stdDev * deviation,
      lower: mean - stdDev * deviation,
    };
  }

  private calculateStochasticK(history: number[], highs: number[], lows: number[], period: number): number | null {
    if (history.length < period) return null;
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    const close = history[history.length - 1];
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  private calculateStochasticD(kValues: number[], period: number): number | null {
    if (kValues.length < period) return null;
    const slice = kValues.slice(-period);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.highHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.dValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const highs = this.highHistory.get(bar.tokenId)!;
    const lows = this.lowHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const dVals = this.dValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    history.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);

    if (history.length > 200) history.shift();
    if (highs.length > 200) highs.shift();
    if (lows.length > 200) lows.shift();

    const bollinger = this.calculateBollinger(history, this.params.bollinger_period, this.params.bollinger_std_dev);

    const kValue = this.calculateStochasticK(history, highs, lows, this.params.stoch_k_period);
    if (kValue !== null) {
      kVals.push(kValue);
      if (kVals.length > 200) kVals.shift();

      const dValue = this.calculateStochasticD(kVals, this.params.stoch_d_period);
      if (dValue !== null) {
        dVals.push(dValue);
        if (dVals.length > 200) dVals.shift();
      }
    }

    const position = ctx.getPosition(bar.tokenId);

    if (!bollinger) {
      return;
    }

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);

      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.close <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (bar.close >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (bar.close >= bollinger.upper) {
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
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (kVals.length >= 2 && dVals.length >= 2) {
        const prevK = kVals[kVals.length - 2];
        const prevD = dVals[dVals.length - 2];
        const currK = kVals[kVals.length - 1];
        const currD = dVals[dVals.length - 1];

        const crossedUp = prevK <= prevD && currK > currD;
        const oversold = currK <= this.params.stoch_oversold;
        const hitsLowerBand = bar.close <= bollinger.lower;

        if (crossedUp && oversold && hitsLowerBand) {
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
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
