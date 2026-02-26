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

function williamsR(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (highs.length < period || lows.length < period || closes.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return -50;
  return ((h - closes[closes.length - 1]) / (h - l)) * -100;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function shouldSkipPrice(close: number): boolean {
  return close <= 1.0;
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

export interface StratIterStock007Params extends StrategyParams {
  wr_period: number;
  wr_extreme: number;
  wr_recover: number;
  sr_lookback: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIterStock007Strategy extends BaseIterStrategy<StratIterStock007Params> {
  private wrCache: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIterStock007Params> = {}) {
    super('strat_iter_stock_007.params.json', {
      wr_period: 14,
      wr_extreme: -85,
      wr_recover: -60,
      sr_lookback: 50,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 25,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.wrCache.has(bar.tokenId)) this.wrCache.set(bar.tokenId, []);

    const { series, barNum } = this.nextBar(bar);
    
    const wr = williamsR(series.highs, series.lows, series.closes, this.params.wr_period);
    if (wr !== null) capPush(this.wrCache.get(bar.tokenId)!, wr);
    
    const wrVals = this.wrCache.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

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

    if (shouldSkipPrice(bar.close) || !sr || wrVals.length < 2) return;

    const nearSupport = bar.close <= sr.support * 1.02;
    const wrExtreme = wrVals[wrVals.length - 2] < this.params.wr_extreme;
    const wrRecovered = wrVals[wrVals.length - 1] >= this.params.wr_recover;

    if (nearSupport && wrExtreme && wrRecovered) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
