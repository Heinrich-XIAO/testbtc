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

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return 50;
  return ((closes[closes.length - 1] - l) / (h - l)) * 100;
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

function computeMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function computeStd(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = computeMean(arr);
  const sqDiffs = arr.map(x => Math.pow(x - mean, 2));
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / arr.length);
}

function linearRegression(y: number[], x: number[]): { beta: number; alpha: number } | null {
  if (y.length !== x.length || y.length < 2) return null;
  const n = y.length;
  const meanX = computeMean(x);
  const meanY = computeMean(y);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - meanX) * (y[i] - meanY);
    den += Math.pow(x[i] - meanX, 2);
  }
  if (den === 0) return null;
  const beta = num / den;
  const alpha = meanY - beta * meanX;
  return { beta, alpha };
}

function adfTest(series: number[], maxLag: number = 4): number | null {
  if (series.length < 25) return null;
  const n = series.length;
  const y: number[] = [];
  const x: number[] = [];
  for (let i = 1; i < n; i++) {
    y.push(series[i] - series[i - 1]);
    x.push(series[i - 1]);
  }
  const nDiff = y.length;
  const meanY = computeMean(y);
  const meanX = computeMean(x);
  let num = 0;
  let den = 0;
  for (let i = 0; i < nDiff; i++) {
    num += (x[i] - meanX) * (y[i] - meanY);
    den += Math.pow(x[i] - meanX, 2);
  }
  if (den === 0) return null;
  const rho = num / den;
  const rhoSE = Math.sqrt(1 / den);
  const adfStat = rho / rhoSE;
  return adfStat;
}

function computeSpread(closes: number[], ma: number[], window: number): { spread: number[]; zScore: number | null } | null {
  if (closes.length < window || ma.length < window) return null;
  const sliceCloses = closes.slice(-window);
  const sliceMa = ma.slice(-window);
  const regResult = linearRegression(sliceCloses, sliceMa);
  if (!regResult) return null;
  const spread: number[] = [];
  for (let i = 0; i < window; i++) {
    spread.push(sliceCloses[i] - regResult.beta * sliceMa[i] - regResult.alpha);
  }
  const mean = computeMean(spread);
  const std = computeStd(spread);
  if (std === 0) return { spread, zScore: null };
  const zScore = (spread[spread.length - 1] - mean) / std;
  return { spread, zScore };
}

abstract class BaseIterStrategy<P extends StrategyParams> implements Strategy {
  params: P;
  protected series: Map<string, TokenSeries> = new Map();
  protected maValues: Map<string, number[]> = new Map();
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
      this.maValues.set(bar.tokenId, []);
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

  protected updateMA(bar: Bar, period: number): number | null {
    const s = this.series.get(bar.tokenId);
    if (!s || s.closes.length < period) return null;
    const slice = s.closes.slice(-period);
    const ma = computeMean(slice);
    const mas = this.maValues.get(bar.tokenId)!;
    capPush(mas, ma);
    return ma;
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

export interface StratIter80AParams extends StrategyParams {
  ma_period: number;
  spread_window: number;
  z_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter80AStrategy extends BaseIterStrategy<StratIter80AParams> {
  constructor(params: Partial<StratIter80AParams> = {}) {
    super('strat_iter80_a.params.json', {
      ma_period: 20,
      spread_window: 30,
      z_threshold: 2.0,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const ma = this.updateMA(bar, this.params.ma_period);
    const k = stochK(series.closes, series.highs, series.lows, 14);
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

    if (shouldSkipPrice(bar.close) || !sr || !ma) return;

    const mas = this.maValues.get(bar.tokenId)!;
    const spreadResult = computeSpread(series.closes, mas, this.params.spread_window);
    if (!spreadResult || spreadResult.zScore === null) return;

    const adfStat = adfTest(spreadResult.spread);
    const isCointegrated = adfStat !== null && adfStat < -2.5;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const extremeSpread = spreadResult.zScore < -this.params.z_threshold;

    if (nearSupport && stochOversold && extremeSpread && isCointegrated) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
