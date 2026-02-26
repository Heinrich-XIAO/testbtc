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

export interface StratIterStock016Params extends StrategyParams { lookback: number; pct: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock016Strategy extends BaseIterStrategy<StratIterStock016Params> {
  constructor(params: Partial<StratIterStock016Params> = {}) { super('strat_iter_stock_016.params.json', { lookback: 15, pct: 0.08, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 20, risk_percent: 0.25 }, params); }
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
    const avg = series.closes.slice(-this.params.lookback).reduce((a, b) => a + b, 0) / this.params.lookback;
    if (bar.close < avg * (1 - this.params.pct)) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock017Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock017Strategy extends BaseIterStrategy<StratIterStock017Params> {
  constructor(params: Partial<StratIterStock017Params> = {}) { super('strat_iter_stock_017.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 30, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 5) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    if (series.closes[series.closes.length - 1] < series.closes[series.closes.length - 2] && series.closes[series.closes.length - 2] < series.closes[series.closes.length - 3]) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock018Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock018Strategy extends BaseIterStrategy<StratIterStock018Params> {
  constructor(params: Partial<StratIterStock018Params> = {}) { super('strat_iter_stock_018.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 25, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 10) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const min = Math.min(...series.closes.slice(-10));
    if (bar.close < min * 1.02) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock019Params extends StrategyParams { period: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock019Strategy extends BaseIterStrategy<StratIterStock019Params> {
  constructor(params: Partial<StratIterStock019Params> = {}) { super('strat_iter_stock_019.params.json', { period: 8, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 20, risk_percent: 0.25 }, params); }
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
    const pct = (series.closes[series.closes.length - 1] - series.closes[series.closes.length - 1 - this.params.period]) / series.closes[series.closes.length - 1 - this.params.period];
    if (pct < -0.05) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock020Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock020Strategy extends BaseIterStrategy<StratIterStock020Params> {
  constructor(params: Partial<StratIterStock020Params> = {}) { super('strat_iter_stock_020.params.json', { stop_loss: 0.10, profit_target: 0.20, max_hold_bars: 25, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 20) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const recent = series.closes.slice(-5); const older = series.closes.slice(-20, -5);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / 5;
    const avgOlder = older.reduce((a, b) => a + b, 0) / 15;
    if (avgRecent < avgOlder * 0.95) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
