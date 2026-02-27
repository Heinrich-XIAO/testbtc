import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter167EParams extends StrategyParams {
  opening_bars: number;
  breakout_buffer: number;
  stop_loss: number;
  profit_target: number;
  risk_percent: number;
}

const defaultParams: StratIter167EParams = {
  opening_bars: 5,
  breakout_buffer: 0.002,
  stop_loss: 1.0,
  profit_target: 2,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter167EParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter167_e.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter167EStrategy implements Strategy {
  params: StratIter167EParams;
  private prices: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private stopPrice: Map<string, number> = new Map();
  private rangeHigh: Map<string, number> = new Map();
  private rangeLow: Map<string, number> = new Map();
  private rangeSet: Map<string, boolean> = new Map();

  constructor(params: Partial<StratIter167EParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter167EParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateATR(tokenId: string, period: number = 14): number | null {
    const highs = this.highs.get(tokenId);
    const lows = this.lows.get(tokenId);
    const prices = this.prices.get(tokenId);
    if (!highs || !lows || !prices || prices.length < 2) return null;

    const trValues: number[] = [];
    const len = Math.min(highs.length, lows.length, prices.length);
    for (let i = 1; i < len && trValues.length < period; i++) {
      const high = highs[highs.length - i];
      const low = lows[lows.length - i];
      const prevClose = prices[prices.length - i - 1];
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trValues.unshift(tr);
    }
    if (trValues.length < period) return null;
    return trValues.reduce((a, b) => a + b, 0) / period;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.prices.has(bar.tokenId)) {
      this.prices.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.rangeSet.set(bar.tokenId, false);
    }

    const prices = this.prices.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;

    prices.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);

    if (prices.length > 200) {
      prices.shift();
      highs.shift();
      lows.shift();
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId)!;
      const stop = this.stopPrice.get(bar.tokenId)!;
      const risk = Math.abs(entry - stop);
      const profitTarget = entry + (risk * this.params.profit_target);

      if (bar.low <= stop || bar.high >= profitTarget) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.stopPrice.delete(bar.tokenId);
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;

    const barsProcessed = prices.length;
    const rangeSet = this.rangeSet.get(bar.tokenId)!;

    if (barsProcessed >= this.params.opening_bars && !rangeSet) {
      const openingHighs = highs.slice(-this.params.opening_bars);
      const openingLows = lows.slice(-this.params.opening_bars);
      const orHigh = Math.max(...openingHighs);
      const orLow = Math.min(...openingLows);

      this.rangeHigh.set(bar.tokenId, orHigh);
      this.rangeLow.set(bar.tokenId, orLow);
      this.rangeSet.set(bar.tokenId, true);
    }

    if (!this.rangeSet.get(bar.tokenId)) return;

    const orHigh = this.rangeHigh.get(bar.tokenId)!;
    const orLow = this.rangeLow.get(bar.tokenId)!;
    const buffer = this.params.breakout_buffer;

    const longTrigger = orHigh * (1 + buffer);
    const shortTrigger = orLow * (1 - buffer);

    const atr = this.calculateATR(bar.tokenId, 14);
    if (atr === null) return;

    if (bar.close > longTrigger) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const stopDistance = atr * this.params.stop_loss;
      const stopPrice = Math.max(orLow, bar.close - stopDistance);
      const riskPerUnit = Math.abs(bar.close - stopPrice);
      if (riskPerUnit <= 0) return;
      const size = (ctx.getCapital() * this.params.risk_percent * 0.995) / riskPerUnit;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.stopPrice.set(bar.tokenId, stopPrice);
        }
      }
    } else if (bar.close < shortTrigger) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const stopDistance = atr * this.params.stop_loss;
      const stopPrice = Math.min(orHigh, bar.close + stopDistance);
      const riskPerUnit = Math.abs(stopPrice - bar.close);
      if (riskPerUnit <= 0) return;
      const size = (ctx.getCapital() * this.params.risk_percent * 0.995) / riskPerUnit;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.stopPrice.set(bar.tokenId, stopPrice);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
