import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = { closes: number[]; };

function loadSavedParams<T extends StrategyParams>(fileName: string): Partial<T> | null {
  const paramsPath = path.join(__dirname, fileName);
  if (!fs.existsSync(paramsPath)) return null;
  try { return JSON.parse(fs.readFileSync(paramsPath, 'utf-8')); } catch { return null; }
}

function capPush(values: number[], value: number, max = 500): void { values.push(value); if (values.length > max) values.shift(); }

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function shouldSkipPrice(close: number): boolean { return close <= 0.05 || close >= 0.95; }

abstract class BaseIterStrategy<P extends StrategyParams> implements Strategy {
  params: P;
  protected series: Map<string, TokenSeries> = new Map();
  protected fastMA: Map<string, number[]> = new Map();
  protected slowMA: Map<string, number[]> = new Map();
  protected entryPrice: Map<string, number> = new Map();
  protected entryBar: Map<string, number> = new Map();
  constructor(fileName: string, defaults: P, params: Partial<P>) { const saved = loadSavedParams<P>(fileName); this.params = { ...defaults, ...saved, ...params } as P; }
  onInit(_ctx: BacktestContext): void {}
  protected nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) { this.series.set(bar.tokenId, { closes: [] }); this.fastMA.set(bar.tokenId, []); this.slowMA.set(bar.tokenId, []); }
    const s = this.series.get(bar.tokenId)!; capPush(s.closes, bar.close);
    const f = this.fastMA.get(bar.tokenId)!; const sl = this.slowMA.get(bar.tokenId)!;
    const fast = sma(s.closes, this.params.fast_period); const slow = sma(s.closes, this.params.slow_period);
    if (fast !== null) f.push(fast); if (slow !== null) sl.push(slow);
    const barNum = f.length; return { series: s, barNum };
  }
  protected open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
    const cash = ctx.getCapital() * riskPercent * 0.995; const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (result.success) { this.entryPrice.set(bar.tokenId, bar.close); this.entryBar.set(bar.tokenId, barNum); return true; }
    return false;
  }
  protected close(ctx: BacktestContext, tokenId: string): void { ctx.close(tokenId); this.entryPrice.delete(tokenId); this.entryBar.delete(tokenId); }
  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter173CParams extends StrategyParams { fast_period: number; slow_period: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIter173CStrategy extends BaseIterStrategy<StratIter173CParams> {
  constructor(params: Partial<StratIter173CParams> = {}) { super('strat_iter173_c.params.json', { fast_period: 10, slow_period: 20, stop_loss: 0.08, profit_target: 0.15, max_hold_bars: 24, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { barNum } = this.nextBar(bar);
    const f = this.fastMA.get(bar.tokenId)!; const s = this.slowMA.get(bar.tokenId)!;
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) { const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!; if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) { this.close(ctx, bar.tokenId); } return; }
    if (shouldSkipPrice(bar.close) || f.length < 2 || s.length < 2) return;
    const prevFast = f[f.length - 2], currFast = f[f.length - 1];
    const prevSlow = s[s.length - 2], currSlow = s[s.length - 1];
    if (prevFast <= prevSlow && currFast > currSlow) { this.open(ctx, bar, barNum, this.params.risk_percent); }
  }
}
