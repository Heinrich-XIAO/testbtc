import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Med RSI div
 */

export interface RsiDV03StrategyParams extends StrategyParams {
  rsi_period: number;
  divergence_lookback: number;
  oversold: number;
  overbought: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: RsiDV03StrategyParams = {
  rsi_period: 6,
  divergence_lookback: 7,
  oversold: 25,
  overbought: 75,
  stop_loss: 0.05,
  risk_percent: 0.12,
};

function loadSavedParams(): Partial<RsiDV03StrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_rsi_d_v03_196.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<RsiDV03StrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof RsiDV03StrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class RsiDV03Strategy implements Strategy {
  params: RsiDV03StrategyParams;
  private rsiMap: Map<string, RSI> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private rsiHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<RsiDV03StrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.rsi_period = Math.max(3, Math.floor(this.params.rsi_period));
    this.params.divergence_lookback = Math.max(3, Math.floor(this.params.divergence_lookback));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.rsiMap.has(bar.tokenId)) {
      this.rsiMap.set(bar.tokenId, new RSI(this.params.rsi_period));
      this.priceHistory.set(bar.tokenId, []);
      this.rsiHistory.set(bar.tokenId, []);
    }
    const rsi = this.rsiMap.get(bar.tokenId)!;
    rsi.update(bar.close);
    const rsiVal = rsi.get(0);
    if (rsiVal === undefined) return;

    const prices = this.priceHistory.get(bar.tokenId)!;
    const rsis = this.rsiHistory.get(bar.tokenId)!;
    prices.push(bar.close);
    rsis.push(rsiVal);
    if (prices.length > this.params.divergence_lookback) {
      prices.shift();
      rsis.shift();
    }

    if (prices.length < this.params.divergence_lookback) return;

    // Bullish divergence: price makes lower low but RSI makes higher low
    const priceLow = Math.min(...prices.slice(0, -1));
    const rsiLow = Math.min(...rsis.slice(0, -1));
    const bullishDiv = bar.close <= priceLow && rsiVal > rsiLow && rsiVal < this.params.oversold;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (rsiVal >= this.params.overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (bullishDiv) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}

