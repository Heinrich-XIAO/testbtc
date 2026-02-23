import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface SimpleMAParams extends StrategyParams {
  fast_period: number;
  slow_period: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: SimpleMAParams = {
  fast_period: 10,
  slow_period: 30,
  stop_loss: 0.08,
  trailing_stop: 0.05,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<SimpleMAParams> | null {
  const paramsPath = path.join(__dirname, 'strat_simple_ma_01.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class SimpleMAStrategy implements Strategy {
  params: SimpleMAParams;
  private fastMA: Map<string, number[]> = new Map();
  private slowMA: Map<string, number[]> = new Map();
  private prices: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestSinceEntry: Map<string, number> = new Map();

  constructor(params: Partial<SimpleMAParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  private getMA(prices: number[], period: number): number | null {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.prices.has(bar.tokenId)) {
      this.prices.set(bar.tokenId, []);
      this.fastMA.set(bar.tokenId, []);
      this.slowMA.set(bar.tokenId, []);
    }

    const prices = this.prices.get(bar.tokenId)!;
    prices.push(bar.close);
    if (prices.length > 200) prices.shift();

    const fastMAList = this.fastMA.get(bar.tokenId)!;
    const slowMAList = this.slowMA.get(bar.tokenId)!;

    const fast = this.getMA(prices, this.params.fast_period);
    const slow = this.getMA(prices, this.params.slow_period);

    if (fast !== null) fastMAList.push(fast);
    if (slow !== null) slowMAList.push(slow);
    if (fastMAList.length > 100) fastMAList.shift();
    if (slowMAList.length > 100) slowMAList.shift();

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId) || bar.close;
      const highest = this.highestSinceEntry.get(bar.tokenId) || entry;
      
      if (bar.close > highest) {
        this.highestSinceEntry.set(bar.tokenId, bar.close);
      }

      if (bar.close <= entry * (1 - this.params.stop_loss)) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.highestSinceEntry.delete(bar.tokenId);
        return;
      }

      if (this.params.trailing_stop > 0) {
        const trailPrice = highest * (1 - this.params.trailing_stop);
        if (bar.close <= trailPrice && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestSinceEntry.delete(bar.tokenId);
          return;
        }
      }

      if (fastMAList.length >= 2 && slowMAList.length >= 2) {
        const prevFast = fastMAList[fastMAList.length - 2];
        const prevSlow = slowMAList[slowMAList.length - 2];
        const currFast = fastMAList[fastMAList.length - 1];
        const currSlow = slowMAList[slowMAList.length - 1];

        if (prevFast >= prevSlow && currFast < currSlow) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestSinceEntry.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (fastMAList.length >= 2 && slowMAList.length >= 2) {
        const prevFast = fastMAList[fastMAList.length - 2];
        const prevSlow = slowMAList[slowMAList.length - 2];
        const currFast = fastMAList[fastMAList.length - 1];
        const currSlow = slowMAList[slowMAList.length - 1];

        if (prevFast <= prevSlow && currFast > currSlow) {
          const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
          const size = cash / bar.close;
          if (size > 0 && cash <= ctx.getCapital()) {
            const result = ctx.buy(bar.tokenId, size);
            if (result.success) {
              this.entryPrice.set(bar.tokenId, bar.close);
              this.highestSinceEntry.set(bar.tokenId, bar.close);
            }
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
