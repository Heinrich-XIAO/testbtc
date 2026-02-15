import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Long Donchian channel breakout
 */

export interface DonchianLongStrategyParams extends StrategyParams {
  channel_period: number;
  stop_loss: number;
  trailing_stop: number;
  exit_at_mid: number;
  risk_percent: number;
}

const defaultParams: DonchianLongStrategyParams = {
  channel_period: 15,
  stop_loss: 0.08,
  trailing_stop: 0.06,
  exit_at_mid: 1,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<DonchianLongStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_donchian_long_19.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<DonchianLongStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof DonchianLongStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class DonchianLongStrategy implements Strategy {
  params: DonchianLongStrategyParams;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<DonchianLongStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.channel_period = Math.max(3, Math.floor(this.params.channel_period));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > this.params.channel_period + 1) history.shift();

    if (history.length < this.params.channel_period) return;

    const lookback = history.slice(0, -1);
    const channelHigh = Math.max(...lookback);
    const channelLow = Math.min(...lookback);
    const channelMid = (channelHigh + channelLow) / 2;
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
        // Exit at mid-channel for mean reversion, or at low for trend following
        if (bar.close <= channelMid && this.params.exit_at_mid > 0.5) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (bar.close > channelHigh) {
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

