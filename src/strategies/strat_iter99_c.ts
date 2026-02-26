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

function correlationFilterSignal(closes: number[], corrThreshold: number): { signal: number; selectedCount: number; avgCorr: number } | null {
  if (closes.length < 15) return null;
  
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  
  const features: number[][] = [];
  
  features.push(returns.slice(-10).map((_, i) => returns[returns.length - 1 - i] || 0));
  features.push(returns.slice(-5).map((_, i) => returns[returns.length - 1 - i] || 0));
  
  const ma5 = returns.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const ma10 = returns.slice(-10).reduce((a, b) => a + b, 0) / 10;
  features.push([ma5, ma10]);
  
  const win5 = returns.slice(-5);
  const mean5 = win5.reduce((a, b) => a + b, 0) / 5;
  const std5 = Math.sqrt(win5.reduce((sum, r) => sum + (r - mean5) ** 2, 0) / 5);
  features.push([std5, Math.abs(mean5)]);
  
  const target = returns[returns.length - 1];
  
  const correlations: number[] = [];
  for (const featureSet of features) {
    const mean = featureSet.reduce((a, b) => a + b, 0) / featureSet.length;
    const std = Math.sqrt(featureSet.reduce((sum, f) => sum + (f - mean) ** 2, 0) / featureSet.length);
    
    if (std > 0 && featureSet.length > 0) {
      const lastVal = featureSet[0];
      const normVal = (lastVal - mean) / std;
      correlations.push(Math.abs(normVal * target / std));
    }
  }
  
  const selectedCorrelations = correlations.filter(c => c >= corrThreshold);
  const avgCorr = correlations.length > 0 ? correlations.reduce((a, b) => a + b, 0) / correlations.length : 0;
  
  const momentum = returns[returns.length - 1];
  const momentumChange = momentum - (returns[returns.length - 2] || 0);
  
  const signal = -momentum * 5 + momentumChange * 3;
  
  return { signal, selectedCount: selectedCorrelations.length, avgCorr };
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

export interface StratIter99CParams extends StrategyParams {
  corr_threshold: number;
  signal_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter99CStrategy extends BaseIterStrategy<StratIter99CParams> {
  constructor(params: Partial<StratIter99CParams> = {}) {
    super('strat_iter99_c.params.json', {
      corr_threshold: 0.3,
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
    const cfResult = correlationFilterSignal(series.closes, this.params.corr_threshold);

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

    if (shouldSkipPrice(bar.close) || !sr || !cfResult) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const cfBuy = cfResult.signal > this.params.signal_threshold;

    if (nearSupport && stochOversold && cfBuy) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}