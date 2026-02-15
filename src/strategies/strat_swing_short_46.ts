import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Short swing trading at lows
 */

export interface SwingShortStrategyParams extends StrategyParams {
  swing_window: number;
  stop_loss: number;
  trailing_stop: number;
  take_profit: number;
  risk_percent: number;
}

const defaultParams: SwingShortStrategyParams = {
  swing_window: 3,
  stop_loss: 0.05,
  trailing_stop: 0.04,
  take_profit: 0.08,
  risk_percent: 0.1,
};

function loadSavedParams(): Partial<SwingShortStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_swing_short_46.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<SwingShortStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof SwingShortStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class SwingShortStrategy implements Strategy {
  params: SwingShortStrategyParams;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<SwingShortStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  private findSwingLow(history: number[], window: number): boolean {
    if (history.length < window * 2 + 1) return false;
    const idx = history.length - 1 - window;
    const val = history[idx];
    for (let i = idx - window; i <= idx + window; i++) {
      if (i !== idx && history[i] <= val) return false;
    }
    return true;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    const window = Math.max(2, Math.floor(this.params.swing_window));
    if (history.length > window * 3 + 2) history.shift();

    const isSwingLow = this.findSwingLow(history, window);
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
        if (bar.close >= entry * (1 + this.params.take_profit)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (isSwingLow) {
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

