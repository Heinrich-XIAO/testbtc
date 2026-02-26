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

function rateOfChange(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  const current = closes[closes.length - 1];
  const past = closes[closes.length - period - 1];
  if (past === 0) return null;
  return ((current - past) / past) * 100;
}

function wma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  let sum = 0;
  let weightSum = 0;
  for (let i = 0; i < period; i++) {
    const weight = period - i;
    sum += values[values.length - period + i] * weight;
    weightSum += weight;
  }
  return sum / weightSum;
}

function coppockCurve(closes: number[], roc1Period: number, roc2Period: number, wmaPeriod: number): number | null {
  if (closes.length < Math.max(roc1Period, roc2Period) + wmaPeriod + 1) return null;
  
  const roc1 = rateOfChange(closes, roc1Period);
  const roc2 = rateOfChange(closes, roc2Period);
  
  if (roc1 === null || roc2 === null) return null;
  
  const coppockValues: number[] = [];
  for (let i = Math.max(roc1Period, roc2Period) + 1; i < closes.length; i++) {
    const r1 = ((closes[i] - closes[i - roc1Period]) / closes[i - roc1Period]) * 100;
    const r2 = ((closes[i] - closes[i - roc2Period]) / closes[i - roc2Period]) * 100;
    coppockValues.push(r1 + r2);
  }
  
  return wma(coppockValues, wmaPeriod);
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

export interface StratIter131EParams extends StrategyParams {
  coppock_oversold: number;
  roc1_period: number;
  roc2_period: number;
  wma_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter131EStrategy extends BaseIterStrategy<StratIter131EParams> {
  constructor(params: Partial<StratIter131EParams> = {}) {
    super('strat_iter131_e.params.json', {
      coppock_oversold: 0,
      roc1_period: 11,
      roc2_period: 14,
      wma_period: 10,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const coppock = coppockCurve(series.closes, this.params.roc1_period, this.params.roc2_period, this.params.wma_period);
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

    if (shouldSkipPrice(bar.close) || !sr || coppock === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const coppockOversold = coppock < this.params.coppock_oversold;

    if (nearSupport && coppockOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}