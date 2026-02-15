import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Quick dip 2bar
 */

export interface PatV01StrategyParams extends StrategyParams {
  consec_bars: number;
  exit_bars: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: PatV01StrategyParams = {
  consec_bars: 2,
  exit_bars: 1,
  stop_loss: 0.03,
  trailing_stop: 0.02,
  risk_percent: 0.08,
};

function loadSavedParams(): Partial<PatV01StrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_pat_v01_174.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<PatV01StrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof PatV01StrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class PatV01Strategy implements Strategy {
  params: PatV01StrategyParams;
  private priceHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<PatV01StrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) this.priceHistory.set(bar.tokenId, []);
    const history = this.priceHistory.get(bar.tokenId)!;
    history.push(bar.close);
    const required = Math.max(3, Math.floor(this.params.consec_bars)) + 1;
    if (history.length > required + 2) history.shift();

    if (history.length < required) return;

    // Count consecutive up or down bars
    let consecUp = 0, consecDown = 0;
    for (let i = history.length - 1; i > 0; i--) {
      if (history[i] > history[i - 1]) {
        if (consecDown > 0) break;
        consecUp++;
      } else if (history[i] < history[i - 1]) {
        if (consecUp > 0) break;
        consecDown++;
      } else break;
    }

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
        if (consecDown >= Math.floor(this.params.exit_bars)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Buy after consecutive down bars (reversal bet) or consecutive up bars (momentum)
      const buySignal = this.params.buy_on_dip > 0.5 
        ? consecDown >= Math.floor(this.params.consec_bars)
        : consecUp >= Math.floor(this.params.consec_bars);
      if (buySignal) {
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

