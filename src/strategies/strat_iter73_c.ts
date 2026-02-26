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

export interface StratIter73CParams extends StrategyParams {
  embedding_dim: number;
  tau: number;
  window_size: number;
  dim_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

function reconstructPhaseSpace(prices: number[], m: number, tau: number): number[][] | null {
  const n = prices.length;
  const requiredLength = (m - 1) * tau + 1;
  if (n < requiredLength) return null;
  
  const vectors: number[][] = [];
  for (let i = 0; i <= n - requiredLength; i++) {
    const vector: number[] = [];
    for (let j = 0; j < m; j++) {
      vector.push(prices[i + j * tau]);
    }
    vectors.push(vector);
  }
  return vectors;
}

function euclideanDistance(v1: number[], v2: number[]): number {
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += Math.pow(v1[i] - v2[i], 2);
  }
  return Math.sqrt(sum);
}

function calculateCorrelationIntegral(vectors: number[][], r: number): number {
  const n = vectors.length;
  if (n < 2) return 0;
  
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = euclideanDistance(vectors[i], vectors[j]);
      if (dist <= r) {
        count++;
      }
    }
  }
  
  const totalPairs = (n * (n - 1)) / 2;
  return count / totalPairs;
}

function calculateCorrelationDimension(prices: number[], m: number, tau: number): number | null {
  const vectors = reconstructPhaseSpace(prices, m, tau);
  if (!vectors || vectors.length < 10) return null;
  
  const distances: number[] = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      distances.push(euclideanDistance(vectors[i], vectors[j]));
    }
  }
  
  if (distances.length === 0) return null;
  
  const minDist = Math.min(...distances.filter(d => d > 0)) * 1.1;
  const maxDist = Math.max(...distances) * 0.9;
  
  if (minDist >= maxDist) return null;
  
  const rValues: number[] = [];
  const cValues: number[] = [];
  
  const numR = 10;
  const logMin = Math.log(minDist);
  const logMax = Math.log(maxDist);
  const step = (logMax - logMin) / (numR - 1);
  
  for (let i = 0; i < numR; i++) {
    const r = Math.exp(logMin + i * step);
    const c = calculateCorrelationIntegral(vectors, r);
    if (c > 0 && c < 1) {
      rValues.push(r);
      cValues.push(c);
    }
  }
  
  if (rValues.length < 5) return null;
  
  const logR = rValues.map(r => Math.log(r));
  const logC = cValues.map(c => Math.log(c));
  
  const n = logR.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += logR[i];
    sumY += logC[i];
    sumXY += logR[i] * logC[i];
    sumX2 += logR[i] * logR[i];
  }
  
  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-10) return null;
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  
  return slope;
}

export class StratIter73CStrategy extends BaseIterStrategy<StratIter73CParams> {
  private kVals: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter73CParams> = {}) {
    super('strat_iter73_c.params.json', {
      embedding_dim: 3,
      tau: 3,
      window_size: 40,
      dim_threshold: 2.0,
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

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2) return;

    const windowCloses = series.closes.slice(-this.params.window_size);
    const corrDim = calculateCorrelationDimension(
      windowCloses,
      this.params.embedding_dim,
      this.params.tau
    );

    if (corrDim === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = kv[kv.length - 1] < this.params.stoch_oversold;
    const lowDimension = corrDim < this.params.dim_threshold;

    if (nearSupport && stochOversold && lowDimension) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
