import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter31AParams extends StrategyParams {
  macd_fast: number;
  macd_slow: number;
  macd_signal: number;
  support_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter31AParams = {
  macd_fast: 12,
  macd_slow: 26,
  macd_signal: 9,
  support_threshold: 0.01,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 32,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter31AParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter31_a.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StratIter31AStrategy implements Strategy {
  params: StratIter31AParams;
  private priceHistory: Map<string, number[]> = new Map();
  private highHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private macdLine: Map<string, number[]> = new Map();
  private signalLine: Map<string, number[]> = new Map();
  private fastEMA: Map<string, number | null> = new Map();
  private slowEMA: Map<string, number | null> = new Map();
  private prevFastEMA: Map<string, number | null> = new Map();
  private prevSlowEMA: Map<string, number | null> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();
  private supportResistance: Map<string, { support: number; resistance: number }> = new Map();

  constructor(params: Partial<StratIter31AParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter31AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateEMAValue(prevEma: number | null, price: number, period: number): number {
    const multiplier = 2 / (period + 1);
    if (prevEma === null) {
      return price;
    }
    return (price - prevEma) * multiplier + prevEma;
  }

  private calculateSupportResistance(
    history: number[],
    highs: number[],
    lows: number[],
    lookback: number
  ): { support: number; resistance: number } {
    const lowSlice = lows.slice(-lookback);
    const highSlice = highs.slice(-lookback);
    return {
      support: Math.min(...lowSlice),
      resistance: Math.max(...highSlice),
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.highHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.macdLine.set(bar.tokenId, []);
      this.signalLine.set(bar.tokenId, []);
      this.fastEMA.set(bar.tokenId, null);
      this.slowEMA.set(bar.tokenId, null);
      this.prevFastEMA.set(bar.tokenId, null);
      this.prevSlowEMA.set(bar.tokenId, null);
      this.barCount.set(bar.tokenId, 0);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const highs = this.highHistory.get(bar.tokenId)!;
    const lows = this.lowHistory.get(bar.tokenId)!;
    const macdVals = this.macdLine.get(bar.tokenId)!;
    const signalVals = this.signalLine.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    history.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);

    if (history.length > 100) history.shift();
    if (highs.length > 100) highs.shift();
    if (lows.length > 100) lows.shift();

    if (history.length >= this.params.macd_slow) {
      const prevFast = this.fastEMA.get(bar.tokenId) ?? null;
      const prevSlow = this.slowEMA.get(bar.tokenId) ?? null;

      const fastEma = this.calculateEMAValue(prevFast, bar.close, this.params.macd_fast);
      const slowEma = this.calculateEMAValue(prevSlow, bar.close, this.params.macd_slow);

      this.prevFastEMA.set(bar.tokenId, prevFast);
      this.prevSlowEMA.set(bar.tokenId, prevSlow);
      this.fastEMA.set(bar.tokenId, fastEma);
      this.slowEMA.set(bar.tokenId, slowEma);

      if (fastEma !== null && slowEma !== null) {
        const macd = fastEma - slowEma;
        macdVals.push(macd);
        if (macdVals.length > 50) macdVals.shift();

        if (macdVals.length >= this.params.macd_signal) {
          const prevSignal = signalVals.length > 0 ? signalVals[signalVals.length - 1] : null;
          const signalEma = this.calculateEMAValue(prevSignal, macd, this.params.macd_signal);
          signalVals.push(signalEma);
          if (signalVals.length > 50) signalVals.shift();
        }
      }
    }

    const sr = this.calculateSupportResistance(history, highs, lows, this.params.sr_lookback);
    this.supportResistance.set(bar.tokenId, sr);

    const position = ctx.getPosition(bar.tokenId);

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

        if (bar.close >= sr.resistance) {
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
      if (macdVals.length >= 2 && signalVals.length >= 2) {
        const prevMACD = macdVals[macdVals.length - 2];
        const prevSignal = signalVals[signalVals.length - 2];
        const currMACD = macdVals[macdVals.length - 1];
        const currSignal = signalVals[signalVals.length - 1];

        const crossedAbove = prevMACD <= prevSignal && currMACD > currSignal;

        const priceNearSupport = (bar.close - sr.support) / sr.support <= this.params.support_threshold;

        if (crossedAbove && priceNearSupport) {
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
