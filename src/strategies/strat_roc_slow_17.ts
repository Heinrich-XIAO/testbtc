import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Slow rate of change for trend detection
 */

export interface ROCSlowStrategyParams extends StrategyParams {
  lookback: number;
  entry_threshold: number;
  exit_threshold: number;
  min_hold: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: ROCSlowStrategyParams = {
  lookback: 8,
  entry_threshold: 0.05,
  exit_threshold: 0.03,
  min_hold: 3,
  stop_loss: 0.08,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<ROCSlowStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_roc_slow_17.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<ROCSlowStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof ROCSlowStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class ROCSlowStrategy implements Strategy {
  params: ROCSlowStrategyParams;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();
  private barsHeld: Map<string, number> = new Map();

  constructor(params: Partial<ROCSlowStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.lookback = Math.max(2, Math.floor(this.params.lookback));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > this.params.lookback + 2) history.shift();

    if (history.length <= this.params.lookback) return;

    const roc = (bar.close - history[history.length - 1 - this.params.lookback]) / history[history.length - 1 - this.params.lookback];
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const held = (this.barsHeld.get(bar.tokenId) ?? 0) + 1;
      this.barsHeld.set(bar.tokenId, held);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          this.barsHeld.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (held >= this.params.min_hold && roc < -this.params.exit_threshold) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          this.barsHeld.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (roc >= this.params.entry_threshold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
            this.barsHeld.set(bar.tokenId, 0);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}

