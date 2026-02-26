import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

function loadSavedParams<T extends StrategyParams>(fileName: string): Partial<T> | null {
  const paramsPath = path.join(__dirname, fileName);
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function capPush(values: number[], value: number, max = 500): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return 50;
  return ((closes[closes.length - 1] - l) / (h - l)) * 100;
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

class RLSFilter {
  private theta: number[];
  private P: number[][];
  private lambda: number;
  private t: number;

  constructor(forgettingFactor: number = 0.99) {
    this.theta = [0, 0];
    this.P = [
      [1000, 0],
      [0, 1000]
    ];
    this.lambda = forgettingFactor;
    this.t = 0;
  }

  update(y: number): { intercept: number; slope: number; predicted: number } | null {
    this.t++;
    const x = [1, this.t];
    
    const xTheta = x[0] * this.theta[0] + x[1] * this.theta[1];
    
    const Px = [
      this.P[0][0] * x[0] + this.P[0][1] * x[1],
      this.P[1][0] * x[0] + this.P[1][1] * x[1]
    ];
    
    const xPx = x[0] * Px[0] + x[1] * Px[1];
    const denom = this.lambda + xPx;
    if (Math.abs(denom) < 1e-10) return null;
    
    const K = [Px[0] / denom, Px[1] / denom];
    
    const innovation = y - xTheta;
    this.theta[0] += K[0] * innovation;
    this.theta[1] += K[1] * innovation;
    
    const Kx0 = K[0] * x[0];
    const Kx1 = K[1] * x[1];
    
    const P00 = (this.P[0][0] - K[0] * (this.P[0][0] * x[0] + this.P[0][1] * x[1])) / this.lambda;
    const P01 = (this.P[0][1] - K[0] * (this.P[1][0] * x[0] + this.P[1][1] * x[1])) / this.lambda;
    const P10 = (this.P[1][0] - K[1] * (this.P[0][0] * x[0] + this.P[0][1] * x[1])) / this.lambda;
    const P11 = (this.P[1][1] - K[1] * (this.P[1][0] * x[0] + this.P[1][1] * x[1])) / this.lambda;
    
    this.P = [[P00, P01], [P10, P11]];
    
    return {
      intercept: this.theta[0],
      slope: this.theta[1],
      predicted: this.theta[0] + this.theta[1] * this.t
    };
  }

  reset(): void {
    this.theta = [0, 0];
    this.P = [
      [1000, 0],
      [0, 1000]
    ];
    this.t = 0;
  }
}

abstract class BaseIterStrategy<P extends StrategyParams> implements Strategy {
  params: P;
  protected series: Map<string, TokenSeries> = new Map();
  protected bars: Map<string, number> = new Map();
  protected entryPrice: Map<string, number> = new Map();
  protected entryBar: Map<string, number> = new Map();

  constructor(fileName: string, defaults: P, params: Partial<P>) {
    const saved = loadSavedParams<P>(fileName);
    this.params = { ...defaults, ...saved, ...params } as P;
  }

  onInit(_ctx: BacktestContext): void {}

  protected nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { 
        closes: [], highs: [], lows: []
      });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  protected open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
    const cash = ctx.getCapital() * riskPercent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (result.success) {
      this.entryPrice.set(bar.tokenId, bar.close);
      this.entryBar.set(bar.tokenId, barNum);
      return true;
    }
    return false;
  }

  protected close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter89EParams extends StrategyParams {
  forgetting_factor: number;
  slope_threshold: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter89EStrategy extends BaseIterStrategy<StratIter89EParams> {
  private rlsFilters: Map<string, RLSFilter> = new Map();

  constructor(params: Partial<StratIter89EParams> = {}) {
    super('strat_iter89_e.params.json', {
      forgetting_factor: 0.985,
      slope_threshold: 0.0003,
      stoch_oversold: 16,
      stoch_overbought: 84,
      stop_loss: 0.08,
      profit_target: 0.16,
      max_hold_bars: 24,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);

    if (!this.rlsFilters.has(bar.tokenId)) {
      this.rlsFilters.set(bar.tokenId, new RLSFilter(this.params.forgetting_factor));
    }
    const rls = this.rlsFilters.get(bar.tokenId)!;
    const rlsResult = rls.update(bar.close);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !rlsResult || k === null) return;

    const slopePositive = rlsResult.slope > this.params.slope_threshold;
    const priceBelowTrend = bar.close < rlsResult.predicted;
    const stochOversold = k < this.params.stoch_oversold;

    if (slopePositive && priceBelowTrend && stochOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}