import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Fast price-MA crossover
 */

export interface MCrossFastStrategyParams extends StrategyParams {
  ma_period: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: MCrossFastStrategyParams = {
  ma_period: 5,
  stop_loss: 0.04,
  trailing_stop: 0.03,
  risk_percent: 0.1,
};

function loadSavedParams(): Partial<MCrossFastStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_mcross_fast_52.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<MCrossFastStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof MCrossFastStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class MCrossFastStrategy implements Strategy {
  params: MCrossFastStrategyParams;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private prevPrice: Map<string, number> = new Map();
  private prevMA: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<MCrossFastStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.smaMap.has(bar.tokenId)) {
      this.smaMap.set(bar.tokenId, new SimpleMovingAverage(Math.max(3, Math.floor(this.params.ma_period))));
    }
    const sma = this.smaMap.get(bar.tokenId)!;
    sma.update(bar.close);
    const maVal = sma.get(0);
    if (maVal === undefined) {
      this.prevPrice.set(bar.tokenId, bar.close);
      return;
    }

    const pp = this.prevPrice.get(bar.tokenId);
    const pm = this.prevMA.get(bar.tokenId);
    this.prevPrice.set(bar.tokenId, bar.close);
    this.prevMA.set(bar.tokenId, maVal);
    if (pp === undefined || pm === undefined) return;

    const crossUp = pp <= pm && bar.close > maVal;
    const crossDown = pp >= pm && bar.close < maVal;
    const position = ctx.getPosition(bar.tokenId);

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

