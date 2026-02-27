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

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period)); const l = Math.min(...lows.slice(-period));
  if (h === l) return 50; return ((closes[closes.length - 1] - l) / (h - l)) * 100;
}

function shouldSkipPrice(close: number): boolean { return close <= 0.05 || close >= 0.95; }

abstract class BaseIterStrategy<P extends StrategyParams> implements Strategy {
  params: P;
  protected series: Map<string, TokenSeries> = new Map();
  protected bars: Map<string, number> = new Map();
  protected entryPrice: Map<string, number> = new Map();
  protected entryBar: Map<string, number> = new Map();
  constructor(fileName: string, defaults: P, params: Partial<P>) { const saved = loadSavedParams<P>(fileName); this.params = { ...defaults, ...saved, ...params } as P; }
  onInit(_ctx: BacktestContext): void {}
  protected nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) { this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] }); this.bars.set(bar.tokenId, 0); }
    const s = this.series.get(bar.tokenId)!; capPush(s.closes, bar.close); capPush(s.highs, bar.high); capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1; this.bars.set(bar.tokenId, barNum); return { series: s, barNum };
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

export interface StratIter193EParams extends StrategyParams { stoch_period: number; stoch_oversold: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; }
export class StratIter193EStrategy extends BaseIterStrategy<StratIter193EParams> {
  constructor(params: Partial<StratIter193EParams> = {}) { super('strat_iter193_e.params.json', { stoch_period: 14, stoch_oversold: 20, stop_loss: 0.08, profit_target: 0.10, max_hold_bars: 24, risk_percent: 0.25 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const stoch = stochK(series.closes, series.highs, series.lows, this.params.stoch_period);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) { const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!; if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) { this.close(ctx, bar.tokenId); } return; }
    if (shouldSkipPrice(bar.close) || stoch === null) return;
    if (stoch < this.params.stoch_oversold) { this.open(ctx, bar, barNum, this.params.risk_percent); }
  }
}
