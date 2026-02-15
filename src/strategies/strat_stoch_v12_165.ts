import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Conservative stoch
 */

export interface StochV12StrategyParams extends StrategyParams {
  k_period: number;
  d_period: number;
  oversold: number;
  overbought: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: StochV12StrategyParams = {
  k_period: 14,
  d_period: 6,
  oversold: 10,
  overbought: 90,
  stop_loss: 0.04,
  risk_percent: 0.05,
};

function loadSavedParams(): Partial<StochV12StrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_stoch_v12_165.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<StochV12StrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof StochV12StrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class StochV12Strategy implements Strategy {
  params: StochV12StrategyParams;
  private priceHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<StochV12StrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.k_period = Math.max(3, Math.floor(this.params.k_period));
    this.params.d_period = Math.max(2, Math.floor(this.params.d_period));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
    }
    const history = this.priceHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > this.params.k_period) history.shift();

    if (history.length < this.params.k_period) return;

    const highest = Math.max(...history);
    const lowest = Math.min(...history);
    const k = highest === lowest ? 50 : ((bar.close - lowest) / (highest - lowest)) * 100;
    kVals.push(k);
    if (kVals.length > this.params.d_period) kVals.shift();

    if (kVals.length < this.params.d_period) return;

    const d = kVals.reduce((a, b) => a + b, 0) / kVals.length;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (k >= this.params.overbought && k < d) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (k <= this.params.oversold && k > d) {
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

