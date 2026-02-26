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

function computeReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  return returns;
}

function shannonEntropy(values: number[], bins: number = 10): number {
  if (values.length < 2) return 0;
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  if (range === 0) return 0;
  
  const histogram: number[] = new Array(bins).fill(0);
  
  for (const v of values) {
    const binIdx = Math.min(Math.floor(((v - min) / range) * bins), bins - 1);
    histogram[binIdx]++;
  }
  
  const n = values.length;
  let entropy = 0;
  
  for (const count of histogram) {
    if (count > 0) {
      const p = count / n;
      entropy -= p * Math.log2(p);
    }
  }
  
  return entropy / Math.log2(bins);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function permutationEntropy(values: number[], dim: number): number | null {
  if (values.length < dim) return null;
  
  const patternCounts: Map<string, number> = new Map();
  const n = values.length - dim + 1;
  
  for (let i = 0; i < n; i++) {
    const window = values.slice(i, i + dim);
    const indexed = window.map((v, idx) => ({ v, idx }));
    indexed.sort((a, b) => a.v - b.v);
    const pattern = indexed.map(item => item.idx).join(',');
    patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
  }
  
  const totalPatterns = n;
  let entropy = 0;
  
  for (const count of Array.from(patternCounts.values())) {
    const p = count / totalPatterns;
    entropy -= p * Math.log(p);
  }
  
  const maxEntropy = Math.log(factorial(dim));
  return entropy / maxEntropy;
}

function sampleEntropy(values: number[], dim: number, r: number): number | null {
  if (values.length < dim + 2) return null;
  
  const std = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length - Math.pow(values.reduce((a, b) => a + b, 0) / values.length, 2));
  if (std === 0) return null;
  
  const threshold = r * std;
  
  function countMatches(m: number): number {
    let count = 0;
    for (let i = 0; i < values.length - m; i++) {
      for (let j = i + 1; j < values.length - m; j++) {
        let match = true;
        for (let k = 0; k < m; k++) {
          if (Math.abs(values[i + k] - values[j + k]) > threshold) {
            match = false;
            break;
          }
        }
        if (match) count++;
      }
    }
    return count;
  }
  
  const A = countMatches(dim + 1);
  const B = countMatches(dim);
  
  if (B === 0) return null;
  
  const se = -Math.log(A / B);
  return Math.min(1, Math.max(0, se / 2));
}

function ensembleEntropy(closes: number[], windowSize: number, embeddingDim: number): number | null {
  if (closes.length < windowSize + 1) return null;
  
  const windowCloses = closes.slice(-windowSize);
  const returns = computeReturns(windowCloses);
  
  if (returns.length < embeddingDim + 2) return null;
  
  const shannon = shannonEntropy(returns);
  const perm = permutationEntropy(returns, embeddingDim);
  const sample = sampleEntropy(returns, embeddingDim, 0.2);
  
  if (perm === null || sample === null) return null;
  
  return (shannon + perm + sample) / 3;
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

export interface StratIter76EParams extends StrategyParams {
  window_size: number;
  embedding_dim: number;
  ensemble_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter76EStrategy extends BaseIterStrategy<StratIter76EParams> {
  constructor(params: Partial<StratIter76EParams> = {}) {
    super('strat_iter76_e.params.json', {
      window_size: 40,
      embedding_dim: 3,
      ensemble_threshold: 0.5,
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
    const ensemble = ensembleEntropy(series.closes, this.params.window_size, this.params.embedding_dim);

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

    if (shouldSkipPrice(bar.close) || !sr || ensemble === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const lowEnsemble = ensemble < this.params.ensemble_threshold;

    if (nearSupport && stochOversold && lowEnsemble) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
