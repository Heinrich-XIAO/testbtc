import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

type HistoricalPattern = {
  pattern: number[];
  futureReturn: number;
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

function normalizePattern(prices: number[]): number[] {
  if (prices.length < 2) return prices;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  if (range < 1e-10) return prices.map(() => 0.5);
  return prices.map(p => (p - min) / range);
}

function dtwDistance(pattern1: number[], pattern2: number[]): number {
  const n = pattern1.length;
  const m = pattern2.length;
  
  const dtw: number[][] = [];
  for (let i = 0; i <= n; i++) {
    dtw.push(new Array(m + 1).fill(Infinity));
  }
  dtw[0][0] = 0;
  
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(pattern1[i - 1] - pattern2[j - 1]);
      dtw[i][j] = cost + Math.min(dtw[i - 1][j], dtw[i][j - 1], dtw[i - 1][j - 1]);
    }
  }
  
  return dtw[n][m] / Math.max(n, m);
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

export interface StratIter90CParams extends StrategyParams {
  pattern_length: number;
  forecast_bars: number;
  dtw_threshold: number;
  min_positive_ratio: number;
  min_samples: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter90CStrategy extends BaseIterStrategy<StratIter90CParams> {
  private historicalPatterns: Map<string, HistoricalPattern[]> = new Map();
  private kVals: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter90CParams> = {}) {
    super('strat_iter90_c.params.json', {
      pattern_length: 12,
      forecast_bars: 10,
      dtw_threshold: 0.15,
      min_positive_ratio: 0.55,
      min_samples: 5,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 24,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.historicalPatterns.has(bar.tokenId)) this.historicalPatterns.set(bar.tokenId, []);
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);

    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close)) return;

    const patterns = this.historicalPatterns.get(bar.tokenId)!;
    const closes = series.closes;
    const len = this.params.pattern_length;
    const forecast = this.params.forecast_bars;

    if (closes.length >= len + forecast + 1) {
      const historicalPattern = closes.slice(-(len + forecast + 1), -(forecast + 1));
      const futurePrices = closes.slice(-(forecast + 1));
      const futureReturn = (futurePrices[futurePrices.length - 1] - futurePrices[0]) / futurePrices[0];
      
      const normalizedHist = normalizePattern(historicalPattern);
      patterns.push({ pattern: normalizedHist, futureReturn });
      if (patterns.length > 200) patterns.shift();
    }

    if (closes.length < len + 1) return;

    const currentPattern = normalizePattern(closes.slice(-len));
    let totalDistance = 0;
    let positiveReturns = 0;
    let validSamples = 0;
    const weightedReturns: number[] = [];

    for (const hp of patterns) {
      const distance = dtwDistance(currentPattern, hp.pattern);
      if (distance <= this.params.dtw_threshold) {
        validSamples++;
        const weight = 1 / (1 + distance);
        weightedReturns.push(hp.futureReturn * weight);
        totalDistance += weight;
        if (hp.futureReturn > 0) positiveReturns++;
      }
    }

    if (validSamples < this.params.min_samples) return;

    const positiveRatio = positiveReturns / validSamples;
    const weightedAvgReturn = totalDistance > 0 
      ? weightedReturns.reduce((a, b) => a + b, 0) / totalDistance 
      : 0;

    const stochOversold = k !== null && k < this.params.stoch_oversold;

    if (positiveRatio >= this.params.min_positive_ratio && 
        weightedAvgReturn > 0.01 && 
        stochOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
