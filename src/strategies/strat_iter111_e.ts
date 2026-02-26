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

function wma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const window = values.slice(-period);
  let weightedSum = 0;
  let weightSum = 0;
  for (let i = 0; i < period; i++) {
    const weight = i + 1;
    weightedSum += window[i] * weight;
    weightSum += weight;
  }
  return weightedSum / weightSum;
}

function hma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.floor(Math.sqrt(period));
  if (values.length < period + sqrtPeriod) return null;
  const wmaHalf: number[] = [];
  for (let i = halfPeriod; i <= values.length; i++) {
    const val = wma(values.slice(0, i), halfPeriod);
    if (val !== null) wmaHalf.push(val);
  }
  const wmaFull: number[] = [];
  for (let i = period; i <= values.length; i++) {
    const val = wma(values.slice(0, i), period);
    if (val !== null) wmaFull.push(val);
  }
  if (wmaHalf.length < sqrtPeriod || wmaFull.length < sqrtPeriod) return null;
  const rawHma: number[] = [];
  const minLen = Math.min(wmaHalf.length, wmaFull.length);
  for (let i = 0; i < minLen; i++) {
    rawHma.push(2 * wmaHalf[wmaHalf.length - minLen + i] - wmaFull[wmaFull.length - minLen + i]);
  }
  if (rawHma.length < sqrtPeriod) return null;
  return wma(rawHma, sqrtPeriod);
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

export interface StratIter111EParams extends StrategyParams {
  period: number;
  threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter111EStrategy extends BaseIterStrategy<StratIter111EParams> {
  constructor(params: Partial<StratIter111EParams> = {}) {
    super('strat_iter111_e.params.json', {
      period: 20,
      threshold: 0.005,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const hmaVal = hma(series.closes, this.params.period);
    const prevHma = series.closes.length > this.params.period + Math.floor(Math.sqrt(this.params.period)) + 1 
      ? hma(series.closes.slice(0, -1), this.params.period) 
      : null;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          (sr && bar.high >= sr.resistance * 0.98) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || hmaVal === null || prevHma === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const hmaRising = hmaVal > prevHma && (hmaVal - prevHma) / prevHma >= this.params.threshold;

    if (nearSupport && hmaRising) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
