import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
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

function computeSkewness(data: number[]): number | null {
  if (data.length < 4) return null;
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const variance = data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
  if (variance === 0) return 0;
  const std = Math.sqrt(variance);
  const skewness = data.reduce((sum, x) => sum + ((x - mean) / std) ** 3, 0) / n;
  return skewness;
}

function computeKurtosis(data: number[]): number | null {
  if (data.length < 4) return null;
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const variance = data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / n;
  if (variance === 0) return 0;
  const std = Math.sqrt(variance);
  const kurtosis = data.reduce((sum, x) => sum + ((x - mean) / std) ** 4, 0) / n - 3;
  return kurtosis;
}

function computeReturnsAtScale(closes: number[], scale: number): number[] {
  if (closes.length < scale + 1) return [];
  const scaledReturns: number[] = [];
  for (let i = scale; i < closes.length; i++) {
    const ret = (closes[i] - closes[i - scale]) / closes[i - scale];
    scaledReturns.push(ret);
  }
  return scaledReturns;
}

function computeScaleSimilarity(returns: number[], baseScale: number, maxScale: number, windowSize: number): number | null {
  if (returns.length < windowSize) return null;
  
  const scales = [baseScale, baseScale * 2, baseScale * maxScale];
  const stats: { skewness: number; kurtosis: number }[] = [];
  
  for (const scale of scales) {
    const scaledReturns = computeReturnsAtScale(returns, scale);
    if (scaledReturns.length < windowSize / scale) return null;
    
    const recentReturns = scaledReturns.slice(-Math.floor(windowSize / scale));
    const skewness = computeSkewness(recentReturns);
    const kurtosis = computeKurtosis(recentReturns);
    
    if (skewness === null || kurtosis === null) return null;
    stats.push({ skewness, kurtosis });
  }
  
  let totalDiff = 0;
  let comparisons = 0;
  
  for (let i = 0; i < stats.length; i++) {
    for (let j = i + 1; j < stats.length; j++) {
      const skewDiff = Math.abs(stats[i].skewness - stats[j].skewness);
      const kurtDiff = Math.abs(stats[i].kurtosis - stats[j].kurtosis);
      const skewSimilarity = Math.exp(-skewDiff);
      const kurtSimilarity = Math.exp(-kurtDiff / 2);
      totalDiff += (skewSimilarity + kurtSimilarity) / 2;
      comparisons++;
    }
  }
  
  return comparisons > 0 ? totalDiff / comparisons : null;
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    if (s.closes.length > 0) {
      const ret = (bar.close - s.closes[s.closes.length - 1]) / s.closes[s.closes.length - 1];
      capPush(s.returns, ret);
    }
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

export interface StratIter82CParams extends StrategyParams {
  base_scale: number;
  max_scale: number;
  window_size: number;
  similarity_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter82CStrategy extends BaseIterStrategy<StratIter82CParams> {
  constructor(params: Partial<StratIter82CParams> = {}) {
    super('strat_iter82_c.params.json', {
      base_scale: 1,
      max_scale: 4,
      window_size: 40,
      similarity_threshold: 0.8,
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

    if (shouldSkipPrice(bar.close) || !sr) return;
    if (series.closes.length < this.params.window_size * this.params.max_scale) return;

    const scaleSimilarity = computeScaleSimilarity(
      series.closes,
      this.params.base_scale,
      this.params.max_scale,
      this.params.window_size
    );

    if (scaleSimilarity === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const scaleInvariant = scaleSimilarity >= this.params.similarity_threshold;

    if (nearSupport && stochOversold && scaleInvariant) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
