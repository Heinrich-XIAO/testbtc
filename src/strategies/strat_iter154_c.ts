import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter154CParams extends StrategyParams {
  depth_lookback: number;
  depth_threshold: number;
  min_depth_bars: number;
  stoch_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter154CParams = {
  depth_lookback: 30,
  depth_threshold: 0.6,
  min_depth_bars: 3,
  stoch_period: 14,
  stoch_oversold: 16,
  stoch_overbought: 84,
  stop_loss: 0.08,
  profit_target: 0.12,
  max_hold_bars: 25,
  risk_percent: 0.20,
};

function loadSavedParams(): Partial<StratIter154CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter154_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter154CStrategy implements Strategy {
  params: StratIter154CParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter154CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter154CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calcVolatility(closes: number[], window: number): number | null {
    if (closes.length < window + 1) return null;
    const returns: number[] = [];
    for (let i = 1; i <= window; i++) {
      const ret = (closes[closes.length - i] - closes[closes.length - i - 1]) / closes[closes.length - i - 1];
      returns.push(Math.abs(ret));
    }
    return returns.reduce((a, b) => a + b, 0) / returns.length;
  }

  private estimateDepth(closes: number[], window: number): number | null {
    const vol = this.calcVolatility(closes, window);
    if (!vol || vol === 0) return 1;
    return Math.min(1, 1 / (vol * 100));
  }

  private countHighDepthBars(closes: number[], lookback: number, threshold: number): number {
    let count = 0;
    const barsToCheck = Math.min(lookback, closes.length - 1);
    for (let i = 1; i <= barsToCheck; i++) {
      const depth = this.estimateDepth(closes.slice(0, -i), this.params.depth_lookback);
      if (depth !== null && depth > threshold) {
        count++;
      }
    }
    return count;
  }

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period) return null;
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 300) closes.shift();
    if (highs.length > 300) highs.shift();
    if (lows.length > 300) lows.shift();

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.low <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
        if (bar.high >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (closes.length < this.params.depth_lookback * 2) return;

    const currentDepth = this.estimateDepth(closes, this.params.depth_lookback);
    if (!currentDepth || currentDepth <= this.params.depth_threshold) return;

    const highDepthCount = this.countHighDepthBars(closes, this.params.min_depth_bars, this.params.depth_threshold);
    if (highDepthCount < this.params.min_depth_bars) return;

    const k = this.stochasticK(closes, highs, lows, this.params.stoch_period);
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const stochOverbought = k !== null && k > this.params.stoch_overbought;

    if (stochOversold || stochOverbought) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
