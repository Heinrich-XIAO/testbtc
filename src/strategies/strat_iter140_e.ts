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

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function macd(closes: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number): { macdLine: number; signal: number; histogram: number } | null {
  if (closes.length < slowPeriod + signalPeriod) return null;
  
  const fastEMA = sma(closes, fastPeriod);
  const slowEMA = sma(closes, slowPeriod);
  
  if (fastEMA === null || slowEMA === null) return null;
  
  const macdLine = fastEMA - slowEMA;
  
  return { macdLine, signal: macdLine * 0.9, histogram: macdLine - macdLine * 0.9 };
}

function tradingSystem3(closes: number[], maPeriod: number, macdFast: number, macdSlow: number): { trend: number; macdHist: number } | null {
  if (closes.length < Math.max(maPeriod, macdSlow)) return null;
  
  const ma = sma(closes, maPeriod);
  const m = macd(closes, macdFast, macdSlow, 9);
  
  if (ma === null || m === null) return null;
  
  return {
    trend: closes[closes.length - 1] > ma ? 1 : -1,
    macdHist: m.histogram
  };
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

export interface StratIter140EParams extends StrategyParams { macd_threshold: number; ma_period: number; macd_fast: number; macd_slow: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; sr_lookback: number; }
export class StratIter140EStrategy extends BaseIterStrategy<StratIter140EParams> {
  constructor(params: Partial<StratIter140EParams> = {}) { super('strat_iter140_e.params.json', { macd_threshold: -0.005, ma_period: 20, macd_fast: 12, macd_slow: 26, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 28, risk_percent: 0.25, sr_lookback: 50 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar); const ts3 = tradingSystem3(series.closes, this.params.ma_period, this.params.macd_fast, this.params.macd_slow); const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) { const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!; if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) { this.close(ctx, bar.tokenId); } return; }
    if (shouldSkipPrice(bar.close) || !sr || ts3 === null) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const buySignal = ts3.trend > 0 && ts3.macdHist < this.params.macd_threshold;
    if (nearSupport && buySignal) { this.open(ctx, bar, barNum, this.params.risk_percent); }
  }
}