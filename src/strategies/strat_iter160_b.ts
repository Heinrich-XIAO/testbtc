import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

function loadSavedParams<T extends StrategyParams>(fileName: string): Partial<T> | null {
  const paramsPath = path.join(__dirname, fileName);
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function capPush(values: number[], value: number, max = 500): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function rsi(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

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
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  protected open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
    const cash = ctx.getCapital() * riskPercent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (result.success) {
      this.entryPrice.set(bar.tokenId, bar.close);
      this.entryBar.set(bar.tokenId, barNum);
      return true;
    }
    return false;
  }

  protected close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter160BParams extends StrategyParams {
  sr_lookback: number;
  divergence_lookback: number;
  rsi_period: number;
  rsi_rise_threshold: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter160BStrategy extends BaseIterStrategy<StratIter160BParams> {
  private rsiVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter160BParams> = {}) {
    super(
      'strat_iter160_b.params.json',
      {
        sr_lookback: 50,
        divergence_lookback: 10,
        rsi_period: 14,
        rsi_rise_threshold: 3,
        support_buffer: 0.015,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
  }

  private detectBullishDivergence(series: TokenSeries, rv: number[], lookback: number): boolean {
    if (series.lows.length < lookback + 2 || rv.length < lookback + 2) return false;
    
    let lowestPriceIdx = -1;
    let lowestPrice = Infinity;
    for (let i = series.lows.length - lookback; i < series.lows.length - 1; i++) {
      if (series.lows[i] < lowestPrice) {
        lowestPrice = series.lows[i];
        lowestPriceIdx = i;
      }
    }
    
    if (lowestPriceIdx === -1) return false;
    
    let prevLowestPrice = Infinity;
    for (let i = series.lows.length - lookback - lookback; i < lowestPriceIdx; i++) {
      if (series.lows[i] < prevLowestPrice) {
        prevLowestPrice = series.lows[i];
      }
    }
    
    if (prevLowestPrice === Infinity || lowestPrice >= prevLowestPrice) return false;
    
    let lowestRsiIdx = -1;
    let lowestRsi = Infinity;
    for (let i = rv.length - lookback; i < rv.length - 1; i++) {
      if (rv[i] < lowestRsi) {
        lowestRsi = rv[i];
        lowestRsiIdx = i;
      }
    }
    
    if (lowestRsiIdx === -1) return false;
    
    let prevLowestRsi = Infinity;
    for (let i = rv.length - lookback - lookback; i < lowestRsiIdx; i++) {
      if (rv[i] < prevLowestRsi) {
        prevLowestRsi = rv[i];
      }
    }
    
    if (prevLowestRsi === Infinity) return false;
    
    return lowestRsi > prevLowestRsi;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.rsiVals.has(bar.tokenId)) this.rsiVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const r = rsi(series.closes, this.params.rsi_period);
    if (r !== null) capPush(this.rsiVals.get(bar.tokenId)!, r);
    const rv = this.rsiVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || rv.length < this.params.divergence_lookback + 2) return;
    
    const hasDivergence = this.detectBullishDivergence(series, rv, this.params.divergence_lookback);
    const rsiRising = rv.length >= 2 && rv[rv.length - 1] > rv[rv.length - 2] + this.params.rsi_rise_threshold;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    
    if (hasDivergence && rsiRising && nearSupport) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
