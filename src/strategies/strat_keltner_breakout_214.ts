import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { ATR } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Keltner Channel Breakout Strategy
 * - Uses EMA + ATR bands (Keltner channels)
 * - Enters on breakout above upper band
 * - Exits on return to middle band or stop
 */

export interface KeltnerBreakout214Params extends StrategyParams {
  ema_period: number;
  atr_period: number;
  atr_multiplier: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: KeltnerBreakout214Params = {
  ema_period: 20,
  atr_period: 14,
  atr_multiplier: 2.0,
  stop_loss: 0.05,
  trailing_stop: 0.03,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<KeltnerBreakout214Params> | null {
  const paramsPath = path.join(__dirname, 'strat_keltner_breakout_214.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<KeltnerBreakout214Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof KeltnerBreakout214Params] = value;
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

export class KeltnerBreakout214Strategy implements Strategy {
  params: KeltnerBreakout214Params;
  private priceHistory: Map<string, number[]> = new Map();
  private atrMap: Map<string, ATR> = new Map();
  private emaValues: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<KeltnerBreakout214Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as KeltnerBreakout214Params;
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

    // Update indicators
    atr.update(bar.high, bar.low, bar.close);
    this.updateEMA(bar.tokenId, bar.close);

    const channel = this.getKeltnerChannel(bar.tokenId);
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
          this.clearPosition(bar.tokenId);
          return;
        }

        // Trailing stop
        if (bar.close < newHighest * (1 - this.params.trailing_stop)) {
          ctx.close(bar.tokenId);
          this.clearPosition(bar.tokenId);
          return;
        }

        // Exit at middle band
        if (bar.close < channel.middle) {
          ctx.close(bar.tokenId);
          this.clearPosition(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: breakout above upper Keltner band
      if (bar.close > channel.upper) {
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
