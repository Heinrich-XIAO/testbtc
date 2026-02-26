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

function calculateDFAExponent(prices: number[], minBoxSize: number, maxBoxSize: number): number | null {
  if (prices.length < maxBoxSize + 10) return null;
  
  const series = prices.slice(-maxBoxSize - 10);
  
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const detrended = series.map(p => p - mean);
  
  const y: number[] = [];
  let cumSum = 0;
  for (const d of detrended) {
    cumSum += d;
    y.push(cumSum);
  }
  
  const nValues: number[] = [];
  const fValues: number[] = [];
  
  for (let n = minBoxSize; n <= maxBoxSize; n += Math.max(1, Math.floor((maxBoxSize - minBoxSize) / 6))) {
    const numBoxes = Math.floor(y.length / n);
    if (numBoxes < 2) continue;
    
    let totalVariance = 0;
    
    for (let box = 0; box < numBoxes; box++) {
      const start = box * n;
      const end = start + n;
      const boxData = y.slice(start, end);
      
      const xMean = (n - 1) / 2;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += boxData[i];
        sumXY += i * boxData[i];
        sumX2 += i * i;
      }
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      let boxVariance = 0;
      for (let i = 0; i < n; i++) {
        const trend = slope * i + intercept;
        boxVariance += Math.pow(boxData[i] - trend, 2);
      }
      totalVariance += boxVariance / n;
    }
    
    const fN = Math.sqrt(totalVariance / numBoxes);
    if (fN > 0 && isFinite(fN)) {
      nValues.push(Math.log(n));
      fValues.push(Math.log(fN));
    }
  }
  
  if (nValues.length < 3) return null;
  
  const nMean = nValues.reduce((a, b) => a + b, 0) / nValues.length;
  const fMean = fValues.reduce((a, b) => a + b, 0) / fValues.length;
  
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < nValues.length; i++) {
    numerator += (nValues[i] - nMean) * (fValues[i] - fMean);
    denominator += Math.pow(nValues[i] - nMean, 2);
  }
  
  if (denominator === 0) return null;
  
  return numerator / denominator;
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

export interface StratIter71DParams extends StrategyParams {
  min_box_size: number;
  max_box_size: number;
  dfa_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter71DStrategy extends BaseIterStrategy<StratIter71DParams> {
  private dfaValues: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter71DParams> = {}) {
    super('strat_iter71_d.params.json', {
      min_box_size: 6,
      max_box_size: 30,
      dfa_threshold: 0.45,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.dfaValues.has(bar.tokenId)) {
      this.dfaValues.set(bar.tokenId, []);
    }
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const dfa = calculateDFAExponent(series.closes, this.params.min_box_size, this.params.max_box_size);
    if (dfa !== null) {
      capPush(this.dfaValues.get(bar.tokenId)!, dfa);
    }

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || dfa === null || k === null) return;

    const nearSupport = bar.low <= sr.support * 1.02;
    const stochOversold = k < this.params.stoch_oversold;
    const isAntiCorrelated = dfa < this.params.dfa_threshold;

    if (nearSupport && stochOversold && isAntiCorrelated) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
