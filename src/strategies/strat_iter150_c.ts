import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter150CParams extends StrategyParams {
  adaptation_window: number;
  volatility_adjust: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter150CParams = {
  adaptation_window: 30,
  volatility_adjust: 1.5,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.12,
  max_hold_bars: 25,
  risk_percent: 0.20,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter150CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter150_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter150CStrategy implements Strategy {
  params: StratIter150CParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter150CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter150CParams;
  }

  onInit(_ctx: BacktestContext): void {}

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

  private calcVolatility(closes: number[], window: number): number | null {
    if (closes.length < window + 1) return null;
    const returns: number[] = [];
    for (let i = 1; i <= window; i++) {
      const ret = (closes[closes.length - i] - closes[closes.length - i - 1]) / closes[closes.length - i - 1];
      returns.push(ret * ret);
    }
    return Math.sqrt(returns.reduce((a, b) => a + b, 0) / returns.length);
  }

  private adaptThresholds(closes: number[]): { adaptedStoch: number; adaptedStop: number } {
    const vol = this.calcVolatility(closes, this.params.adaptation_window);
    const baseStoch = this.params.stoch_oversold;
    const baseStop = this.params.stop_loss;
    if (!vol) return { adaptedStoch: baseStoch, adaptedStop: baseStop };
    const avgVol = this.calcVolatility(closes.slice(0, -this.params.adaptation_window), this.params.adaptation_window);
    if (!avgVol) return { adaptedStoch: baseStoch, adaptedStop: baseStop };
    const volRatio = vol / avgVol;
    if (volRatio > this.params.volatility_adjust) {
      return { adaptedStoch: baseStoch + 4, adaptedStop: baseStop * 1.2 };
    } else if (volRatio < 1 / this.params.volatility_adjust) {
      return { adaptedStoch: baseStoch - 2, adaptedStop: baseStop * 0.8 };
    }
    return { adaptedStoch: baseStoch, adaptedStop: baseStop };
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

    const thresholds = this.adaptThresholds(closes);

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.low <= entry * (1 - thresholds.adaptedStop)) {
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
    if (closes.length < this.params.adaptation_window * 2) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const k = this.stochasticK(closes, highs, lows, 14);
    const nearSupport = bar.low <= sr.support * 1.02;
    const stochOversold = k !== null && k < thresholds.adaptedStoch;

    if (nearSupport && stochOversold) {
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