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

export interface StratIterStock011Params extends StrategyParams { lookback: number; pct_drop: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock011Strategy extends BaseIterStrategy<StratIterStock011Params> {
  constructor(params: Partial<StratIterStock011Params> = {}) {
    super('strat_iter_stock_011.params.json', { lookback: 10, pct_drop: 0.05, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 20, risk_percent: 0.25 }, params);
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
    const max = Math.max(...series.closes.slice(-this.params.lookback));
    if ((max - bar.close) / max >= this.params.pct_drop) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock012Params extends StrategyParams { period: number; level: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock012Strategy extends BaseIterStrategy<StratIterStock012Params> {
  constructor(params: Partial<StratIterStock012Params> = {}) {
    super('strat_iter_stock_012.params.json', { period: 5, level: 0.05, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 20, risk_percent: 0.25 }, params);
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
    const pct = (series.closes[series.closes.length - 1] - series.closes[series.closes.length - 1 - this.params.period]) / series.closes[series.closes.length - 1 - this.params.period];
    if (pct < -this.params.level) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock013Params extends StrategyParams { period: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock013Strategy extends BaseIterStrategy<StratIterStock013Params> {
  constructor(params: Partial<StratIterStock013Params> = {}) {
    super('strat_iter_stock_013.params.json', { period: 3, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 15, risk_percent: 0.25 }, params);
  }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    if (series.closes.length < this.params.period + 2) return;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (shouldSkipPrice(bar.close)) return;
    const curr = series.closes[series.closes.length - 1]; const prev = series.closes[series.closes.length - 2];
    const drop = prev - curr; if (drop > 0 && drop / prev > 0.02) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock014Params extends StrategyParams { period: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock014Strategy extends BaseIterStrategy<StratIterStock014Params> {
  constructor(params: Partial<StratIterStock014Params> = {}) {
    super('strat_iter_stock_014.params.json', { period: 5, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 25, risk_percent: 0.25 }, params);
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
    const ma = series.closes.slice(-this.params.period).reduce((a, b) => a + b, 0) / this.params.period;
    if (bar.close < ma * 0.95) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

export interface StratIterStock015Params extends StrategyParams { period: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIterStock015Strategy extends BaseIterStrategy<StratIterStock015Params> {
  constructor(params: Partial<StratIterStock015Params> = {}) {
    super('strat_iter_stock_015.params.json', { period: 10, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 30, risk_percent: 0.25 }, params);
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
    const max = Math.max(...series.closes.slice(-this.params.period));
    if (bar.close < max * 0.90) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
