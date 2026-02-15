import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Volatility breakout with tight contraction
 */

export interface VolBreakTightStrategyParams extends StrategyParams {
  vol_period: number;
  lookback: number;
  contraction_ratio: number;
  breakout_threshold: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: VolBreakTightStrategyParams = {
  vol_period: 8,
  lookback: 12,
  contraction_ratio: 0.5,
  breakout_threshold: 0.02,
  stop_loss: 0.05,
  trailing_stop: 0.04,
  risk_percent: 0.1,
};

function loadSavedParams(): Partial<VolBreakTightStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_vbreak_tight_26.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<VolBreakTightStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof VolBreakTightStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length);
}

export class VolBreakTightStrategy implements Strategy {
  params: VolBreakTightStrategyParams;
  private priceHistory: Map<string, number[]> = new Map();
  private volHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<VolBreakTightStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
    this.params.vol_period = Math.max(3, Math.floor(this.params.vol_period));
    this.params.lookback = Math.max(3, Math.floor(this.params.lookback));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.volHistory.set(bar.tokenId, []);
    }
    const history = this.priceHistory.get(bar.tokenId)!;
    const volHist = this.volHistory.get(bar.tokenId)!;
    history.push(bar.close);
    if (history.length > Math.max(this.params.vol_period, this.params.lookback) + 2) history.shift();

    if (history.length < this.params.vol_period) return;

    const currentVol = stddev(history.slice(-this.params.vol_period));
    volHist.push(currentVol);
    if (volHist.length > this.params.lookback) volHist.shift();

    if (volHist.length < this.params.lookback) return;

    const avgVol = volHist.reduce((a, b) => a + b, 0) / volHist.length;
    const isContraction = currentVol < avgVol * this.params.contraction_ratio;
    const priceChange = history.length >= 2 ? (bar.close - history[history.length - 2]) / history[history.length - 2] : 0;
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
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Buy on breakout after volatility contraction
      if (isContraction && priceChange > this.params.breakout_threshold) {
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

