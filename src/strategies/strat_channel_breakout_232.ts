import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Channel Breakout 232
 * - Donchian-style channel breakout strategy
 * - Enters on new high-period high with confirmation
 * - Uses channel midpoint for trailing exit
 */

export interface ChannelBreakout232Params extends StrategyParams {
  channel_period: number;
  entry_threshold: number;
  confirmation_bars: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: ChannelBreakout232Params = {
  channel_period: 20,
  entry_threshold: 0.01,
  confirmation_bars: 2,
  stop_loss: 0.08,
  trailing_stop: 0.05,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<ChannelBreakout232Params> | null {
  const paramsPath = path.join(__dirname, 'strat_channel_breakout_232.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<ChannelBreakout232Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof ChannelBreakout232Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

interface TokenData {
  highs: number[];
  lows: number[];
  closes: number[];
  breakoutBars: number;
}

export class ChannelBreakout232Strategy implements Strategy {
  params: ChannelBreakout232Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<ChannelBreakout232Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as ChannelBreakout232Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, {
        highs: [],
        lows: [],
        closes: [],
        breakoutBars: 0,
      });
    }
    return this.tokenData.get(tokenId)!;
  }

  private getChannel(data: TokenData): { upper: number; lower: number; mid: number } | null {
    if (data.highs.length < this.params.channel_period) return null;
    
    // Exclude current bar for channel calculation
    const highs = data.highs.slice(-this.params.channel_period - 1, -1);
    const lows = data.lows.slice(-this.params.channel_period - 1, -1);
    
    const upper = Math.max(...highs);
    const lower = Math.min(...lows);
    const mid = (upper + lower) / 2;
    
    return { upper, lower, mid };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const data = this.getOrCreateData(bar.tokenId);
    
    data.highs.push(bar.high);
    data.lows.push(bar.low);
    data.closes.push(bar.close);

    const maxPeriod = this.params.channel_period + 10;
    if (data.highs.length > maxPeriod) {
      data.highs.shift();
      data.lows.shift();
      data.closes.shift();
    }

    const channel = this.getChannel(data);
    if (!channel) return;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const highest = this.highestPrice.get(bar.tokenId) ?? bar.close;
      
      if (entry) {
        if (bar.close > highest) {
          this.highestPrice.set(bar.tokenId, bar.close);
        }
        const newHighest = this.highestPrice.get(bar.tokenId)!;

        // Stop loss
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          data.breakoutBars = 0;
          return;
        }

        // Trailing stop
        if (bar.close < newHighest * (1 - this.params.trailing_stop)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          data.breakoutBars = 0;
          return;
        }

        // Exit if price falls below channel midpoint
        if (bar.close < channel.mid) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          data.breakoutBars = 0;
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Check for breakout
      const breakoutAmount = (bar.close - channel.upper) / channel.upper;
      const isBreakout = breakoutAmount > this.params.entry_threshold;

      if (isBreakout) {
        data.breakoutBars++;
      } else {
        data.breakoutBars = 0;
      }

      // Enter after confirmation bars
      if (data.breakoutBars >= this.params.confirmation_bars) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
            data.breakoutBars = 0;
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
