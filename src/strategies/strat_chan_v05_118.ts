import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Med tight channel
 */

export interface ChanV05StrategyParams extends StrategyParams {
  channel_period: number;
  channel_width: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: ChanV05StrategyParams = {
  channel_period: 8,
  channel_width: 0.4,
  stop_loss: 0.04,
  trailing_stop: 0.03,
  risk_percent: 0.1,
};

function loadSavedParams(): Partial<ChanV05StrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_chan_v05_118.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<ChanV05StrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof ChanV05StrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class ChanV05Strategy implements Strategy {
  params: ChanV05StrategyParams;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<ChanV05StrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    const period = Math.max(3, Math.floor(this.params.channel_period));
    if (!this.smaMap.has(bar.tokenId)) {
      this.smaMap.set(bar.tokenId, new SimpleMovingAverage(period));
      this.priceHistory.set(bar.tokenId, []);
    }
    const sma = this.smaMap.get(bar.tokenId)!;
    const history = this.priceHistory.get(bar.tokenId)!;
    sma.update(bar.close);
    history.push(bar.close);
    if (history.length > period) history.shift();

    const maVal = sma.get(0);
    if (maVal === undefined || history.length < period) return;

    // Channel = MA +/- channel_width * price_range
    const high = Math.max(...history);
    const low = Math.min(...history);
    const range = high - low;
    const upperChannel = maVal + range * this.params.channel_width;
    const lowerChannel = maVal - range * this.params.channel_width;

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
        if (bar.close >= upperChannel) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.90) {
      if (bar.close <= lowerChannel) {
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

