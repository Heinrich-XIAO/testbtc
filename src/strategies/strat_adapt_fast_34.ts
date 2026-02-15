import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Fast adaptive MA crossover
 */

export interface AdaptFastStrategyParams extends StrategyParams {
  min_period: number;
  max_period: number;
  vol_sensitivity: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: AdaptFastStrategyParams = {
  min_period: 3,
  max_period: 12,
  vol_sensitivity: 50,
  stop_loss: 0.05,
  trailing_stop: 0.04,
  risk_percent: 0.1,
};

function loadSavedParams(): Partial<AdaptFastStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_adapt_fast_34.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<AdaptFastStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof AdaptFastStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

export class AdaptFastStrategy implements Strategy {
  params: AdaptFastStrategyParams;
  private priceHistory: Map<string, number[]> = new Map();
  private adaptiveMA: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<AdaptFastStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    const maxLen = Math.max(Math.floor(this.params.max_period), 20);
    if (history.length > maxLen + 2) history.shift();

    if (history.length < Math.floor(this.params.min_period) + 2) return;

    // Adaptive period: use shorter MA in high vol, longer in low vol
    const vol = stddev(history.slice(-Math.min(history.length, 10)));
    const avgPrice = history.reduce((a, b) => a + b, 0) / history.length;
    const relVol = avgPrice > 0 ? vol / avgPrice : 0;
    
    // Map volatility to period: high vol = short period, low vol = long period
    const volScale = Math.min(1, relVol * this.params.vol_sensitivity);
    const period = Math.max(
      Math.floor(this.params.min_period),
      Math.floor(this.params.max_period - (this.params.max_period - this.params.min_period) * volScale)
    );

    const slice = history.slice(-Math.min(history.length, period));
    const maVal = slice.reduce((a, b) => a + b, 0) / slice.length;
    const prevMA = this.adaptiveMA.get(bar.tokenId);
    this.adaptiveMA.set(bar.tokenId, maVal);

    if (prevMA === undefined) return;

    const position = ctx.getPosition(bar.tokenId);
    const crossUp = bar.close > maVal && history[history.length - 2] <= prevMA;
    const crossDown = bar.close < maVal && history[history.length - 2] >= prevMA;

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (crossDown) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (crossUp) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}

