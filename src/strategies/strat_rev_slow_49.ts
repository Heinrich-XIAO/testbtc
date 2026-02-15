import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Slow reversal detector
 */

export interface RevSlowStrategyParams extends StrategyParams {
  lookback: number;
  drop_threshold: number;
  bounce_threshold: number;
  stop_loss: number;
  take_profit: number;
  risk_percent: number;
}

const defaultParams: RevSlowStrategyParams = {
  lookback: 10,
  drop_threshold: 0.08,
  bounce_threshold: 0.03,
  stop_loss: 0.1,
  take_profit: 0.12,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<RevSlowStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_rev_slow_49.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<RevSlowStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof RevSlowStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class RevSlowStrategy implements Strategy {
  params: RevSlowStrategyParams;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<RevSlowStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    const lookback = Math.max(3, Math.floor(this.params.lookback));
    if (history.length > lookback + 2) history.shift();

    if (history.length < lookback) return;

    // Check for reversal: price dropped significantly then bounced
    const recentMin = Math.min(...history.slice(0, -1));
    const dropFromStart = (history[0] - recentMin) / history[0];
    const bounceFromMin = recentMin > 0 ? (bar.close - recentMin) / recentMin : 0;
    
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (bar.close >= entry * (1 + this.params.take_profit)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.90) {
      if (dropFromStart >= this.params.drop_threshold && bounceFromMin >= this.params.bounce_threshold) {
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

