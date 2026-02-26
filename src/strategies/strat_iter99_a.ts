import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  featureImportance: number[];
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

function featureSelectionSignal(closes: number[], series: TokenSeries, numFeatures: number): { signal: number; selectedCount: number } | null {
  if (closes.length < 20) return null;
  
  const allFeatures: number[] = [];
  
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  
  allFeatures.push(returns[returns.length - 1] || 0);
  allFeatures.push(returns.length > 1 ? returns[returns.length - 2] : 0);
  allFeatures.push(returns.length > 2 ? returns[returns.length - 3] : 0);
  allFeatures.push(returns.slice(-5).reduce((a, b) => a + b, 0) / 5);
  allFeatures.push(returns.slice(-10).reduce((a, b) => a + b, 0) / 10);
  
  const window5 = returns.slice(-5);
  const mean5 = window5.reduce((a, b) => a + b, 0) / 5;
  const var5 = window5.reduce((sum, r) => sum + (r - mean5) ** 2, 0) / 5;
  allFeatures.push(Math.sqrt(var5));
  
  const window10 = returns.slice(-10);
  const mean10 = window10.reduce((a, b) => a + b, 0) / 10;
  const var10 = window10.reduce((sum, r) => sum + (r - mean10) ** 2, 0) / 10;
  allFeatures.push(Math.sqrt(var10));
  
  allFeatures.push(returns[returns.length - 1] - returns[returns.length - 2] || 0);
  
  const ma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const ma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  allFeatures.push((closes[closes.length - 1] - ma5) / ma5);
  allFeatures.push((closes[closes.length - 1] - ma10) / ma10);
  
  if (series.featureImportance.length === 0) {
    series.featureImportance = allFeatures.map(() => 0.1);
  }
  
  const target = returns[returns.length - 1];
  for (let i = 0; i < allFeatures.length && i < series.featureImportance.length; i++) {
    const correlation = allFeatures[i] * target > 0 ? 0.1 : -0.05;
    series.featureImportance[i] = Math.max(0.01, Math.min(1, series.featureImportance[i] + correlation * 0.1));
  }
  
  const indexed = allFeatures.map((f, i) => ({ feature: f, importance: series.featureImportance[i] || 0.1 }));
  indexed.sort((a, b) => b.importance - a.importance);
  
  const selected = indexed.slice(0, Math.min(numFeatures, indexed.length));
  const totalImportance = selected.reduce((sum, item) => sum + item.importance, 0);
  
  let signal = 0;
  for (const item of selected) {
    signal += item.feature * (item.importance / totalImportance);
  }
  
  return { signal, selectedCount: selected.length };
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], featureImportance: [] });
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

export interface StratIter99AParams extends StrategyParams {
  num_features: number;
  signal_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter99AStrategy extends BaseIterStrategy<StratIter99AParams> {
  constructor(params: Partial<StratIter99AParams> = {}) {
    super('strat_iter99_a.params.json', {
      num_features: 5,
      signal_threshold: 0.008,
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
    const k = stochK(series.closes, series.highs, series.lows, 14);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const fsResult = featureSelectionSignal(series.closes, series, this.params.num_features);

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

    if (shouldSkipPrice(bar.close) || !sr || !fsResult) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const fsBuy = fsResult.signal > this.params.signal_threshold;

    if (nearSupport && stochOversold && fsBuy) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}