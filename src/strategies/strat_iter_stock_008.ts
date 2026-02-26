import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = { closes: number[]; highs: number[]; lows: number[]; };

function loadSavedParams<T extends StrategyParams>(fileName: string): Partial<T> | null {
  const paramsPath = path.join(__dirname, fileName);
  if (!fs.existsSync(paramsPath)) return null;
  try { return JSON.parse(fs.readFileSync(paramsPath, 'utf-8')); } catch { return null; }
}

function capPush(values: number[], value: number, max = 500): void { values.push(value); if (values.length > max) values.shift(); }

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return values.slice(-period).reduce((s, v) => s + v, 0) / period;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return { support: Math.min(...lows.slice(-(lookback + 1), -1)), resistance: Math.max(...highs.slice(-(lookback + 1), -1)) };
}

function shouldSkipPrice(close: number): boolean { return close <= 1.0; }

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
    if (!this.series.has(bar.tokenId)) { this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] }); this.bars.set(bar.tokenId, 0); }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close); capPush(s.highs, bar.high); capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  protected open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
    const cash = ctx.getCapital() * riskPercent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (result.success) { this.entryPrice.set(bar.tokenId, bar.close); this.entryBar.set(bar.tokenId, barNum); return true; }
    return false;
  }

  protected close(ctx: BacktestContext, tokenId: string): void { ctx.close(tokenId); this.entryPrice.delete(tokenId); this.entryBar.delete(tokenId); }
  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIterStock008Params extends StrategyParams {
  ma_period: number; sr_lookback: number; near_support_pct: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number;
}

export class StratIterStock008Strategy extends BaseIterStrategy<StratIterStock008Params> {
  constructor(params: Partial<StratIterStock008Params> = {}) {
    super('strat_iter_stock_008.params.json', { ma_period: 20, sr_lookback: 50, near_support_pct: 1.02, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 25, risk_percent: 0.25 }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const ma = sma(series.closes, this.params.ma_period);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close) || !sr || ma === null) return;
    if (bar.close <= sr.support * this.params.near_support_pct && bar.close > ma) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock009Params extends StrategyParams {
  lookback: number; pct_below: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number;
}

export class StratIterStock009Strategy extends BaseIterStrategy<StratIterStock009Params> {
  constructor(params: Partial<StratIterStock009Params> = {}) {
    super('strat_iter_stock_009.params.json', { lookback: 20, pct_below: 0.10, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 25, risk_percent: 0.25 }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < this.params.lookback + 1) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const low = Math.min(...series.closes.slice(-this.params.lookback));
    const dist = (low - bar.close) / low;
    if (dist > this.params.pct_below) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock010Params extends StrategyParams {
  period: number; threshold: number; sr_lookback: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number;
}

export class StratIterStock010Strategy extends BaseIterStrategy<StratIterStock010Params> {
  constructor(params: Partial<StratIterStock010Params> = {}) {
    super('strat_iter_stock_010.params.json', { period: 5, threshold: 0.03, sr_lookback: 50, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 25, risk_percent: 0.25 }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < this.params.period + 1) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const change = (series.closes[series.closes.length - 1] - series.closes[series.closes.length - 1 - this.params.period]) / series.closes[series.closes.length - 1 - this.params.period];
    if (change <= -this.params.threshold) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
