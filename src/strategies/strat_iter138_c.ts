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

function mama(closes: number[], fastLimit: number, slowLimit: number): number | null {
  if (closes.length < 50) return null;
  
  const price = closes[closes.length - 1];
  let smooth = 0, detrender = 0, q1 = 0, i1 = 0, jI = 0, jQ = 0, i2 = 0, q2 = 0, re = 0, im = 0, period = 0, smoothPeriod = 0, phase = 0, deltaPhase = 0, alpha = 0, mama = 0;
  
  const prevPrice = closes[closes.length - 2];
  smooth = (4 * price + 3 * prevPrice + 2 * closes[closes.length - 3] + closes[closes.length - 4]) / 10;
  detrender = (0.0962 * smooth + 0.5769 * closes[closes.length - 2] - 0.5769 * closes[closes.length - 4] - 0.0962 * closes[closes.length - 5]) * (0.075 * 1 + 0.54);
  
  q1 = (0.0962 * smooth + 0.5769 * closes[closes.length - 2] - 0.5769 * closes[closes.length - 4] - 0.0962 * closes[closes.length - 5]) * (0.075 * 1 + 0.54);
  i1 = detrender;
  
  jI = (0.0962 * i1 + 0.5769 * i1 - 0.5769 * i1 - 0.0962 * i1) * (0.075 * 1 + 0.54);
  jQ = (0.0962 * q1 + 0.5769 * q1 - 0.5769 * q1 - 0.0962 * q1) * (0.075 * 1 + 0.54);
  
  i2 = i1 - jQ; q2 = q1 + jI;
  
  re = i2 * i2 - q2 * q2; im = 2 * i2 * q2;
  period = 6.28318530718 / Math.atan(im / (re + 0.0000000001));
  smoothPeriod = period * 0.33 + smoothPeriod * 0.67;
  
  phase = Math.atan(q1 / (i1 + 0.0000000001));
  deltaPhase = 0.1;
  alpha = fastLimit / deltaPhase;
  if (alpha < slowLimit) alpha = slowLimit;
  if (alpha > fastLimit) alpha = fastLimit;
  
  mama = price * alpha + closes[closes.length - 2] * (1 - alpha);
  return mama;
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

export interface StratIter138CParams extends StrategyParams { fast_limit: number; slow_limit: number; deviation: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; sr_lookback: number; }
export class StratIter138CStrategy extends BaseIterStrategy<StratIter138CParams> {
  constructor(params: Partial<StratIter138CParams> = {}) { super('strat_iter138_c.params.json', { fast_limit: 0.5, slow_limit: 0.05, deviation: -0.03, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 28, risk_percent: 0.25, sr_lookback: 50 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar); const m = mama(series.closes, this.params.fast_limit, this.params.slow_limit); const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) { const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!; if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) { this.close(ctx, bar.tokenId); } return; }
    if (shouldSkipPrice(bar.close) || !sr || m === null) return;
    const nearSupport = bar.low <= sr.support * 1.015; const belowMAMA = (bar.close - m) / m < this.params.deviation;
    if (nearSupport && belowMAMA) { this.open(ctx, bar, barNum, this.params.risk_percent); }
  }
}