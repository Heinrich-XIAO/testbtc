import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Mean Reversion Band V2 - Second iteration
 * - Wider stddev range for more trades
 * - Added momentum filter
 * - Dynamic position sizing based on band width
 */

export interface MeanReversionBand2_210Params extends StrategyParams {
  bb_period: number;
  bb_stddev_mult: number;
  rsi_period: number;
  rsi_oversold: number;
  rsi_overbought: number;
  momentum_lookback: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: MeanReversionBand2_210Params = {
  bb_period: 20,
  bb_stddev_mult: 1.8,
  rsi_period: 18,
  rsi_oversold: 25,
  rsi_overbought: 65,
  momentum_lookback: 3,
  stop_loss: 0.04,
  trailing_stop: 0.04,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<MeanReversionBand2_210Params> | null {
  const paramsPath = path.join(__dirname, 'strat_mean_reversion_band2_210.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<MeanReversionBand2_210Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof MeanReversionBand2_210Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
  width: number;
}

function calcStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const sqDiffs = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0);
  return Math.sqrt(sqDiffs / values.length);
}

export class MeanReversionBand2_210Strategy implements Strategy {
  params: MeanReversionBand2_210Params;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private rsiMap: Map<string, RSI> = new Map();
  private priceHistoryMap: Map<string, number[]> = new Map();
  private entryPriceMap: Map<string, number> = new Map();
  private highestPriceMap: Map<string, number> = new Map();
  private lowestPriceMap: Map<string, number> = new Map();
  private prevPriceMap: Map<string, number> = new Map();
  private positionSideMap: Map<string, 'long' | 'short'> = new Map();

  constructor(params: Partial<MeanReversionBand2_210Params> = {}) {
    const savedParams = loadSavedParams() ?? {};
    const merged: MeanReversionBand2_210Params = { ...defaultParams };
    for (const [key, value] of Object.entries({ ...savedParams, ...params })) {
      if (key !== 'metadata' && typeof value === 'number') {
        (merged as Record<string, number>)[key] = value;
      }
    }
    this.params = merged;
    this.params.bb_period = Math.max(5, Math.floor(this.params.bb_period));
    this.params.rsi_period = Math.max(3, Math.floor(this.params.rsi_period));
  }

  onInit(_ctx: BacktestContext): void {}

  private getBollingerBands(tokenId: string): BollingerBands | null {
    const history = this.priceHistoryMap.get(tokenId);
    if (!history || history.length < this.params.bb_period) return null;

    const slice = history.slice(-this.params.bb_period);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const std = calcStdDev(slice, mean);
    const offset = std * this.params.bb_stddev_mult;

    return {
      upper: mean + offset,
      middle: mean,
      lower: mean - offset,
      width: (offset * 2) / mean,
    };
  }

  private getMomentum(tokenId: string): number {
    const history = this.priceHistoryMap.get(tokenId);
    if (!history || history.length < this.params.momentum_lookback + 1) return 0;
    const current = history[history.length - 1];
    const past = history[history.length - 1 - this.params.momentum_lookback];
    return (current - past) / past;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistoryMap.has(bar.tokenId)) {
      this.priceHistoryMap.set(bar.tokenId, []);
      this.rsiMap.set(bar.tokenId, new RSI(this.params.rsi_period));
    }

    const history = this.priceHistoryMap.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > this.params.bb_period + 10) history.shift();

    const rsi = this.rsiMap.get(bar.tokenId)!;
    rsi.update(bar.close);
    const rsiValue = rsi.get(0);

    const bb = this.getBollingerBands(bar.tokenId);
    if (!bb || rsiValue === null || rsiValue === undefined) return;

    const prevPrice = this.prevPriceMap.get(bar.tokenId) ?? bar.close;
    this.prevPriceMap.set(bar.tokenId, bar.close);

    const position = ctx.getPosition(bar.tokenId);
    const momentum = this.getMomentum(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPriceMap.get(bar.tokenId);
      const side = this.positionSideMap.get(bar.tokenId);
      const highest = this.highestPriceMap.get(bar.tokenId) ?? bar.close;
      const lowest = this.lowestPriceMap.get(bar.tokenId) ?? bar.close;

      if (entry) {
        if (side === 'long') {
          this.highestPriceMap.set(bar.tokenId, Math.max(highest, bar.close));
          const newHighest = this.highestPriceMap.get(bar.tokenId)!;

          // Stop loss
          if (bar.close < entry * (1 - this.params.stop_loss)) {
            ctx.close(bar.tokenId);
            this.clearPosition(bar.tokenId);
            return;
          }
          // Trailing stop
          if (bar.close < newHighest * (1 - this.params.trailing_stop)) {
            ctx.close(bar.tokenId);
            this.clearPosition(bar.tokenId);
            return;
          }
          // Take profit at middle band
          if (bar.close >= bb.middle && rsiValue >= this.params.rsi_overbought) {
            ctx.close(bar.tokenId);
            this.clearPosition(bar.tokenId);
          }
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Long entry: price touches lower band, starts rising, RSI oversold, positive momentum
      if (bar.close <= bb.lower && bar.close > prevPrice && rsiValue <= this.params.rsi_oversold && momentum > 0) {
        // Dynamic position sizing: wider bands = smaller position
        const sizeMultiplier = Math.max(0.5, 1 - bb.width);
        const cash = ctx.getCapital() * this.params.risk_percent * sizeMultiplier * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPriceMap.set(bar.tokenId, bar.close);
            this.highestPriceMap.set(bar.tokenId, bar.close);
            this.positionSideMap.set(bar.tokenId, 'long');
          }
        }
      }
    }
  }

  private clearPosition(tokenId: string): void {
    this.entryPriceMap.delete(tokenId);
    this.highestPriceMap.delete(tokenId);
    this.lowestPriceMap.delete(tokenId);
    this.positionSideMap.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
}
