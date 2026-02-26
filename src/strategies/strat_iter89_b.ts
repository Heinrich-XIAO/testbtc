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

function exponentialSmoothing(current: number, previousFiltered: number, alpha: number): number {
  return alpha * current + (1 - alpha) * previousFiltered;
}

function alphaFromPeriod(period: number): number {
  return 2 / (period + 1);
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
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

export interface StratIter89BParams extends StrategyParams {
  short_period: number;
  long_period: number;
  stoch_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter89BStrategy extends BaseIterStrategy<StratIter89BParams> {
  private shortFilters: Map<string, number> = new Map();
  private longFilters: Map<string, number> = new Map();
  private prevShortFilters: Map<string, number> = new Map();
  private prevLongFilters: Map<string, number> = new Map();
  
  constructor(params: Partial<StratIter89BParams> = {}) {
    super('strat_iter89_b.params.json', {
      short_period: 5,
      long_period: 20,
      stoch_period: 14,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    
    const tokenId = bar.tokenId;
    const close = bar.close;
    
    const shortAlpha = alphaFromPeriod(this.params.short_period);
    const longAlpha = alphaFromPeriod(this.params.long_period);
    
    const prevShort = this.shortFilters.get(tokenId) ?? close;
    const prevLong = this.longFilters.get(tokenId) ?? close;
    
    this.prevShortFilters.set(tokenId, prevShort);
    this.prevLongFilters.set(tokenId, prevLong);
    
    const shortFilter = exponentialSmoothing(close, prevShort, shortAlpha);
    const longFilter = exponentialSmoothing(close, prevLong, longAlpha);
    
    this.shortFilters.set(tokenId, shortFilter);
    this.longFilters.set(tokenId, longFilter);
    
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_period);
    
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

    if (shouldSkipPrice(bar.close) || k === null) return;
    
    const prevShortFilter = this.prevShortFilters.get(tokenId)!;
    const prevLongFilter = this.prevLongFilters.get(tokenId)!;
    
    const wasAbove = prevShortFilter >= prevLongFilter;
    const isBelow = shortFilter < longFilter;
    const crossBelow = wasAbove && isBelow;
    
    const stochOversold = k < this.params.stoch_oversold;
    
    if (crossBelow && stochOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}