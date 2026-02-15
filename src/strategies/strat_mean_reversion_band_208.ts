import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Bollinger Band Mean Reversion Strategy
 * 
 * - Uses Bollinger Bands (SMA ± 2*stddev) to identify overbought/oversold conditions
 * - Enters long when price touches lower band and starts rising
 * - Enters short when price touches upper band and starts falling
 * - RSI confirmation to avoid extreme zones
 * - Per-token Maps for all indicators
 */

export interface MeanReversionBandV208StrategyParams extends StrategyParams {
  bb_period: number;
  bb_stddev_mult: number;
  rsi_period: number;
  rsi_oversold: number;
  rsi_overbought: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: MeanReversionBandV208StrategyParams = {
  bb_period: 20,
  bb_stddev_mult: 2.0,
  rsi_period: 14,
  rsi_oversold: 30,
  rsi_overbought: 70,
  stop_loss: 0.05,
  trailing_stop: 0.03,
  risk_percent: 0.1,
};

function loadSavedParams(): Partial<MeanReversionBandV208StrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_mean_reversion_band_208.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<MeanReversionBandV208StrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof MeanReversionBandV208StrategyParams] = value;
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
}

export class MeanReversionBandV208Strategy implements Strategy {
  params: MeanReversionBandV208StrategyParams;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private rsiMap: Map<string, RSI> = new Map();
  private priceHistoryMap: Map<string, number[]> = new Map();
  private entryPriceMap: Map<string, number> = new Map();
  private highestPriceMap: Map<string, number> = new Map();
  private lowestPriceMap: Map<string, number> = new Map();
  private prevPriceMap: Map<string, number> = new Map();
  private positionSideMap: Map<string, 'long' | 'short'> = new Map();

  constructor(params: Partial<MeanReversionBandV208StrategyParams> = {}) {
    const savedParams = loadSavedParams() ?? {};
    const merged: MeanReversionBandV208StrategyParams = { ...defaultParams };
    
    for (const [key, value] of Object.entries(savedParams)) {
      if (typeof value === 'number' && key in defaultParams) {
        (merged as Record<string, number>)[key] = value;
      }
    }
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'number' && key in defaultParams) {
        (merged as Record<string, number>)[key] = value;
      }
    }
    
    this.params = merged;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateBollingerBands(prices: number[]): BollingerBands | undefined {
    const period = Math.max(3, Math.floor(this.params.bb_period));
    if (prices.length < period) return undefined;

    const recentPrices = prices.slice(-period);
    const sum = recentPrices.reduce((a, b) => a + b, 0);
    const mean = sum / period;

    const squaredDiffs = recentPrices.map((p) => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const stddev = Math.sqrt(variance);

    const multiplier = Math.max(0.5, this.params.bb_stddev_mult);

    return {
      upper: mean + multiplier * stddev,
      middle: mean,
      lower: mean - multiplier * stddev,
    };
  }

  private isRising(priceHistory: number[]): boolean {
    if (priceHistory.length < 2) return false;
    const current = priceHistory[priceHistory.length - 1];
    const previous = priceHistory[priceHistory.length - 2];
    return current > previous;
  }

  private isFalling(priceHistory: number[]): boolean {
    if (priceHistory.length < 2) return false;
    const current = priceHistory[priceHistory.length - 1];
    const previous = priceHistory[priceHistory.length - 2];
    return current < previous;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const period = Math.max(3, Math.floor(this.params.bb_period));

    if (!this.smaMap.has(bar.tokenId)) {
      this.smaMap.set(bar.tokenId, new SimpleMovingAverage(period));
      this.rsiMap.set(bar.tokenId, new RSI(Math.max(3, Math.floor(this.params.rsi_period))));
      this.priceHistoryMap.set(bar.tokenId, []);
    }

    const sma = this.smaMap.get(bar.tokenId)!;
    const rsi = this.rsiMap.get(bar.tokenId)!;
    const priceHistory = this.priceHistoryMap.get(bar.tokenId)!;

    sma.update(bar.close);
    rsi.update(bar.close);
    priceHistory.push(bar.close);
    if (priceHistory.length > period * 2) {
      priceHistory.shift();
    }

    const bb = this.calculateBollingerBands(priceHistory);
    const rsiVal = rsi.get(0);

    if (!bb || rsiVal === undefined) return;

    const position = ctx.getPosition(bar.tokenId);
    const side = this.positionSideMap.get(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPriceMap.get(bar.tokenId);
      if (!entry) return;

      if (side === 'long') {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPriceMap.delete(bar.tokenId);
          this.highestPriceMap.delete(bar.tokenId);
          this.lowestPriceMap.delete(bar.tokenId);
          this.positionSideMap.delete(bar.tokenId);
          return;
        }

        const highest = Math.max(this.highestPriceMap.get(bar.tokenId) ?? entry, bar.close);
        this.highestPriceMap.set(bar.tokenId, highest);

        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPriceMap.delete(bar.tokenId);
          this.highestPriceMap.delete(bar.tokenId);
          this.lowestPriceMap.delete(bar.tokenId);
          this.positionSideMap.delete(bar.tokenId);
          return;
        }

        if (bar.close >= bb.middle || rsiVal >= this.params.rsi_overbought) {
          ctx.close(bar.tokenId);
          this.entryPriceMap.delete(bar.tokenId);
          this.highestPriceMap.delete(bar.tokenId);
          this.lowestPriceMap.delete(bar.tokenId);
          this.positionSideMap.delete(bar.tokenId);
          return;
        }
      } else if (side === 'short') {
        if (bar.close > entry * (1 + this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPriceMap.delete(bar.tokenId);
          this.highestPriceMap.delete(bar.tokenId);
          this.lowestPriceMap.delete(bar.tokenId);
          this.positionSideMap.delete(bar.tokenId);
          return;
        }

        const lowest = Math.min(this.lowestPriceMap.get(bar.tokenId) ?? entry, bar.close);
        this.lowestPriceMap.set(bar.tokenId, lowest);

        if (bar.close > lowest * (1 + this.params.trailing_stop) && bar.close < entry) {
          ctx.close(bar.tokenId);
          this.entryPriceMap.delete(bar.tokenId);
          this.highestPriceMap.delete(bar.tokenId);
          this.lowestPriceMap.delete(bar.tokenId);
          this.positionSideMap.delete(bar.tokenId);
          return;
        }

        if (bar.close <= bb.middle || rsiVal <= this.params.rsi_oversold) {
          ctx.close(bar.tokenId);
          this.entryPriceMap.delete(bar.tokenId);
          this.highestPriceMap.delete(bar.tokenId);
          this.lowestPriceMap.delete(bar.tokenId);
          this.positionSideMap.delete(bar.tokenId);
          return;
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      const isPriceRising = this.isRising(priceHistory);
      const isPriceFalling = this.isFalling(priceHistory);

      if (bar.close <= bb.lower && isPriceRising && rsiVal > this.params.rsi_oversold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPriceMap.set(bar.tokenId, bar.close);
            this.highestPriceMap.set(bar.tokenId, bar.close);
            this.positionSideMap.set(bar.tokenId, 'long');
          }
        }
      } else if (bar.close >= bb.upper && isPriceFalling && rsiVal < this.params.rsi_overbought) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPriceMap.set(bar.tokenId, bar.close);
            this.lowestPriceMap.set(bar.tokenId, bar.close);
            this.positionSideMap.set(bar.tokenId, 'short');
          }
        }
      }
    }

    this.prevPriceMap.set(bar.tokenId, bar.close);
  }

  onComplete(_ctx: BacktestContext): void {}
}
