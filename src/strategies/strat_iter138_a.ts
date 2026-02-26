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

function adaptiveMA(closes: number[], period: number, fastSC: number, slowSC: number): number | null {
  if (closes.length < period) return null;
  const fast = 2 / (fastSC + 1);
  const slow = 2 / (slowSC + 1);
  
  let erSum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    erSum += Math.abs(closes[i] - closes[i - 1]);
  }
  const change = Math.abs(closes[closes.length - 1] - closes[closes.length - period]);
  const er = erSum > 0 ? change / erSum : 0;
  
  const sc = Math.pow(er * (fast - slow) + slow, 2);
  return closes[closes.length - 2] + sc * (closes[closes.length - 1] - closes[closes.length - 2]);
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

export interface StratIter138AParams extends StrategyParams { ama_period: number; fast_sc: number; slow_sc: number; deviation: number; stop_loss: number; profit_target: number; max_hold_bars: number; risk_percent: number; sr_lookback: number; }
export class StratIter138AStrategy extends BaseIterStrategy<StratIter138AParams> {
  constructor(params: Partial<StratIter138AParams> = {}) { super('strat_iter138_a.params.json', { ama_period: 10, fast_sc: 2, slow_sc: 30, deviation: -0.03, stop_loss: 0.08, profit_target: 0.18, max_hold_bars: 28, risk_percent: 0.25, sr_lookback: 50 }, params); }
  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar); const ama = adaptiveMA(series.closes, this.params.ama_period, this.params.fast_sc, this.params.slow_sc); const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) { const e = this.entryPrice.get(bar.tokenId)!; const eb = this.entryBar.get(bar.tokenId)!; if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) { this.close(ctx, bar.tokenId); } return; }
    if (shouldSkipPrice(bar.close) || !sr || ama === null) return;
    const nearSupport = bar.low <= sr.support * 1.015; const belowAMA = (bar.close - ama) / ama < this.params.deviation;
    if (nearSupport && belowAMA) { this.open(ctx, bar, barNum, this.params.risk_percent); }
  }
}