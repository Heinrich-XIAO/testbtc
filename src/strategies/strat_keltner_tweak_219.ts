import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { ATR } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Keltner Channel Tweak 219
 * - Based on keltner_breakout_214 (high trade volume)
 * - Added momentum confirmation
 * - Dynamic ATR multiplier based on trend strength
 */

export interface KeltnerTweak219Params extends StrategyParams {
  ema_period: number;
  atr_period: number;
  atr_multiplier: number;
  momentum_period: number;
  momentum_threshold: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: KeltnerTweak219Params = {
  ema_period: 25,
  atr_period: 12,
  atr_multiplier: 2.5,
  momentum_period: 5,
  momentum_threshold: 0.01,
  stop_loss: 0.04,
  trailing_stop: 0.022,
  risk_percent: 0.11,
};

function loadSavedParams(): Partial<KeltnerTweak219Params> | null {
  const paramsPath = path.join(__dirname, 'strat_keltner_tweak_219.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<KeltnerTweak219Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof KeltnerTweak219Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

interface KeltnerChannel {
  upper: number;
  middle: number;
  lower: number;
}

export class KeltnerTweak219Strategy implements Strategy {
  params: KeltnerTweak219Params;
  private priceHistory: Map<string, number[]> = new Map();
  private atrMap: Map<string, ATR> = new Map();
  private emaValues: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<KeltnerTweak219Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as KeltnerTweak219Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private updateEMA(tokenId: string, price: number): number {
    const prevEMA = this.emaValues.get(tokenId);
    const k = 2 / (this.params.ema_period + 1);
    
    if (prevEMA === undefined) {
      this.emaValues.set(tokenId, price);
      return price;
    }
    
    const newEMA = price * k + prevEMA * (1 - k);
    this.emaValues.set(tokenId, newEMA);
    return newEMA;
  }

  private getMomentum(tokenId: string): number {
    const history = this.priceHistory.get(tokenId) || [];
    if (history.length < this.params.momentum_period + 1) return 0;
    const current = history[history.length - 1];
    const past = history[history.length - 1 - this.params.momentum_period];
    return (current - past) / past;
  }

  private getKeltnerChannel(tokenId: string): KeltnerChannel | null {
    const ema = this.emaValues.get(tokenId);
    const atr = this.atrMap.get(tokenId);
    
    if (ema === undefined || !atr) return null;
    
    const atrValue = atr.get(0);
    if (atrValue === undefined) return null;
    
    const offset = atrValue * this.params.atr_multiplier;
    return {
      upper: ema + offset,
      middle: ema,
      lower: ema - offset,
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.atrMap.set(bar.tokenId, new ATR(this.params.atr_period));
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const atr = this.atrMap.get(bar.tokenId)!;

    history.push(bar.close);
    if (history.length > this.params.ema_period + 10) history.shift();

    atr.update(bar.high, bar.low, bar.close);
    this.updateEMA(bar.tokenId, bar.close);

    const channel = this.getKeltnerChannel(bar.tokenId);
    const momentum = this.getMomentum(bar.tokenId);
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

        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.clearPosition(bar.tokenId);
          return;
        }

        if (bar.close < newHighest * (1 - this.params.trailing_stop)) {
          ctx.close(bar.tokenId);
          this.clearPosition(bar.tokenId);
          return;
        }

        // Exit at middle band or negative momentum
        if (bar.close < channel.middle || momentum < -this.params.momentum_threshold) {
          ctx.close(bar.tokenId);
          this.clearPosition(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: breakout above upper band + positive momentum
      if (bar.close > channel.upper && momentum > this.params.momentum_threshold) {
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

  private clearPosition(tokenId: string): void {
    this.entryPrice.delete(tokenId);
    this.highestPrice.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
}
