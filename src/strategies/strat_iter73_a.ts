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

function grangerCausalityF(prices: number[], numLags: number, windowSize: number): number | null {
  if (prices.length < windowSize + numLags + 2) return null;
  
  const windowPrices = prices.slice(-windowSize);
  const returns: number[] = [];
  for (let i = 1; i < windowPrices.length; i++) {
    returns.push((windowPrices[i] - windowPrices[i - 1]) / windowPrices[i - 1]);
  }
  
  const n = returns.length;
  if (n < numLags + 2) return null;
  
  const y = returns.slice(numLags);
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  
  let rssRestricted = 0;
  for (let i = 0; i < y.length; i++) {
    rssRestricted += Math.pow(y[i] - mean, 2);
  }
  
  let rssUnrestricted = 0;
  for (let t = 0; t < y.length; t++) {
    let predicted = 0;
    const intercept = mean;
    for (let lag = 1; lag <= numLags; lag++) {
      const ret = returns[numLags - t - 1 + (numLags - lag)];
      if (ret !== undefined) {
        predicted += 0.1 * ret;
      }
    }
    predicted += intercept;
    rssUnrestricted += Math.pow(y[t] - predicted, 2);
  }
  
  if (rssUnrestricted <= 0.0000001) return null;
  
  const dfNum = numLags;
  const dfDenom = n - numLags - 1;
  if (dfDenom <= 0) return null;
  
  const fStat = ((rssRestricted - rssUnrestricted) / dfNum) / (rssUnrestricted / dfDenom);
  
  return Math.max(0, fStat);
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

export interface StratIter73AParams extends StrategyParams {
  num_lags: number;
  window_size: number;
  f_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter73AStrategy extends BaseIterStrategy<StratIter73AParams> {
  private kVals: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter73AParams> = {}) {
    super('strat_iter73_a.params.json', {
      num_lags: 3,
      window_size: 40,
      f_threshold: 1.5,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) {
      this.kVals.set(bar.tokenId, []);
    }
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const fStat = grangerCausalityF(series.closes, this.params.num_lags, this.params.window_size);

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

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || fStat === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const highGranger = fStat > this.params.f_threshold;

    if (nearSupport && stochOversold && highGranger) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
