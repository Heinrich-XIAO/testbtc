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

function shouldSkipPrice(close: number): boolean { return close <= 0.05 || close >= 0.95; }

function frama(closes: number[], period: number): number | null {
  if (closes.length < period * 2) return null;
  
  const half = Math.floor(period / 2);
  const n1 = closes.slice(-period, -half);
  const n2 = closes.slice(-half);
  const n3 = closes.slice(-period);
  
  const h1 = Math.max(...n1); const l1 = Math.min(...n1);
  const h2 = Math.max(...n2); const l2 = Math.min(...n2);
  const h3 = Math.max(...n3); const l3 = Math.min(...n3);
  
  const e1 = (h1 - l1) / half; const e2 = (h2 - l2) / half; const e3 = (h3 - l3) / period;
  
  const d = e3 > 0 ? (Math.log(e1 + e2) - Math.log(e3)) / Math.log(2) : 0;
  const alpha = Math.exp(-4.6 * (d - 1));
  
  return closes[closes.length - 2] + alpha * (closes[closes.length - 1] - closes[closes.length - 2]);
}

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

export interface StratIter138BParams extends StrategyParams { frama_period: number; deviation: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; sr_lookback: number; }
export class StratIter138BStrategy extends BaseIterStrategy<StratIter138BParams> {
  constructor(params: Partial<StratIter138BParams> = {}) { super('strat_iter138_b.params.json', { frama_period: 16, deviation: -0.03, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 28, risk_percent: 0.25, sr_lookback: 50 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar); const fr = frama(series.closes, this.params.frama_period); const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) { const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!; if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) { this.close(ctx, bar.tokenId); } return; }
    if (shouldSkipPrice(bar.close) || !sr || fr === null) return;
    const nearSupport = bar.low <= sr.support * 1.015; const belowFRAMA = (bar.close - fr) / fr < this.params.deviation;
    if (nearSupport && belowFRAMA) { this.open(ctx, bar, barNum, this.params.risk_percent); }
  }
}