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

export interface StratIterStock021Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock021Strategy extends BaseIterStrategy<StratIterStock021Params> {
  constructor(params: Partial<StratIterStock021Params> = {}) { super('strat_iter_stock_021.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 30, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 8) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const down = series.closes.slice(-4).every((p, i, a) => i === 0 || p < a[i - 1]);
    if (down && series.closes[series.closes.length - 1] > series.closes[series.closes.length - 2]) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock022Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock022Strategy extends BaseIterStrategy<StratIterStock022Params> {
  constructor(params: Partial<StratIterStock022Params> = {}) { super('strat_iter_stock_022.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 25, risk_percent: 0.25 }, params); }
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
    const low20 = Math.min(...series.closes.slice(-20));
    if (bar.close < low20 * 1.03) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock023Params extends StrategyParams { lookback: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock023Strategy extends BaseIterStrategy<StratIterStock023Params> {
  constructor(params: Partial<StratIterStock023Params> = {}) { super('strat_iter_stock_023.params.json', { lookback: 12, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 20, risk_percent: 0.25 }, params); }
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
    const pct = (series.closes[series.closes.length - 1] - series.closes[series.closes.length - this.params.lookback]) / series.closes[series.closes.length - this.params.lookback];
    if (pct < -0.08) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock024Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock024Strategy extends BaseIterStrategy<StratIterStock024Params> {
  constructor(params: Partial<StratIterStock024Params> = {}) { super('strat_iter_stock_024.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 25, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 15) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const avg = series.closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
    if (bar.close < avg * 0.92) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock025Params extends StrategyParams { stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock025Strategy extends BaseIterStrategy<StratIterStock025Params> {
  constructor(params: Partial<StratIterStock025Params> = {}) { super('strat_iter_stock_025.params.json', { stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 30, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < 25) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const max = Math.max(...series.closes.slice(-25));
    if (bar.close < max * 0.88) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
