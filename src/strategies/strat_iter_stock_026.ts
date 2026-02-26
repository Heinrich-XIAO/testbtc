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

export interface StratIterStock026Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock026Strategy extends BaseIterStrategy<StratIterStock026Params> {
  constructor(params: Partial<StratIterStock026Params> = {}) { super('strat_iter_stock_026.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 25, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 14) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const pct = (series.closes[series.closes.length - 1] - series.closes[series.closes.length - 14]) / series.closes[series.closes.length - 14];
    if (pct < -0.10) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock027Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock027Strategy extends BaseIterStrategy<StratIterStock027Params> {
  constructor(params: Partial<StratIterStock027Params> = {}) { super('strat_iter_stock_027.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 30, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 6) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    if (series.closes.slice(-3).every((p, i, a) => i === 0 || p < a[i - 1] * 0.98)) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock028Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock028Strategy extends BaseIterStrategy<StratIterStock028Params> {
  constructor(params: Partial<StratIterStock028Params> = {}) { super('strat_iter_stock_028.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 25, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 30) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const avg = series.closes.slice(-30).reduce((a, b) => a + b, 0) / 30;
    if (bar.close < avg * 0.90) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock029Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock029Strategy extends BaseIterStrategy<StratIterStock029Params> {
  constructor(params: Partial<StratIterStock029Params> = {}) { super('strat_iter_stock_029.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 20, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 7) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const pct = (series.closes[series.closes.length - 1] - series.closes[series.closes.length - 6]) / series.closes[series.closes.length - 6];
    if (pct < -0.06) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock030Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock030Strategy extends BaseIterStrategy<StratIterStock030Params> {
  constructor(params: Partial<StratIterStock030Params> = {}) { super('strat_iter_stock_030.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 25, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 12) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const high = Math.max(...series.closes.slice(-12));
    if (bar.close < high * 0.85) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock031Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock031Strategy extends BaseIterStrategy<StratIterStock031Params> {
  constructor(params: Partial<StratIterStock031Params> = {}) { super('strat_iter_stock_031.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 30, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 40) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const avg40 = series.closes.slice(-40).reduce((a, b) => a + b, 0) / 40;
    const avg10 = series.closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    if (avg10 < avg40 * 0.92) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
