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

function computeStdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function computeCorrelationIntegral(data: number[], m: number, epsilon: number): number {
  const n = data.length - m + 1;
  if (n < 2) return 0;

  let count = 0;
  let total = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let maxDiff = 0;
      for (let k = 0; k < m; k++) {
        const diff = Math.abs(data[i + k] - data[j + k]);
        if (diff > maxDiff) maxDiff = diff;
      }
      if (maxDiff <= epsilon) count++;
      total++;
    }
  }

  return total > 0 ? count / total : 0;
}

function computeBDSTest(closes: number[], windowSize: number, embeddingDim: number, epsilonRatio: number): number | null {
  if (closes.length < windowSize + embeddingDim + 10) return null;

  const slice = closes.slice(-windowSize);
  
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const demeaned = slice.map(x => x - mean);
  
  const std = computeStdDev(slice);
  if (std === 0) return null;
  
  const epsilon = epsilonRatio * std;

  const c1 = computeCorrelationIntegral(demeaned, 1, epsilon);
  const cm = computeCorrelationIntegral(demeaned, embeddingDim, epsilon);

  if (c1 <= 0 || c1 >= 1) return null;

  const n = slice.length;
  const cmExpected = Math.pow(c1, embeddingDim);

  const k = embeddingDim;
  
  let sumK = 0;
  for (let r = 1; r <= k; r++) {
    sumK += 2 * Math.pow(c1, 2 * r);
  }
  
  const variance = 4 * (Math.pow(k, 2) * Math.pow(c1, 2 * k - 2) * (1 - c1) + sumK - k * k * c1 * c1);
  
  if (variance <= 0) return null;
  
  const stdError = Math.sqrt(variance / n);
  
  if (stdError === 0) return null;
  
  const bdsStat = (cm - cmExpected) / stdError;

  return bdsStat;
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

export interface StratIter79EParams extends StrategyParams {
  embedding_dim: number;
  epsilon_ratio: number;
  window_size: number;
  bds_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter79EStrategy extends BaseIterStrategy<StratIter79EParams> {
  constructor(params: Partial<StratIter79EParams> = {}) {
    super('strat_iter79_e.params.json', {
      embedding_dim: 3,
      epsilon_ratio: 1.0,
      window_size: 40,
      bds_threshold: 2.0,
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

    const bdsStat = computeBDSTest(
      series.closes,
      this.params.window_size,
      this.params.embedding_dim,
      this.params.epsilon_ratio
    );

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

    if (shouldSkipPrice(bar.close) || !sr || bdsStat === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const hasNonlinearity = bdsStat > this.params.bds_threshold;

    if (nearSupport && stochOversold && hasNonlinearity) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
