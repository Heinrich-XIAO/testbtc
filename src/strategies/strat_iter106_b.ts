import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  imfs: number[][];
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

function findExtrema(data: number[]): { maxima: number[]; minima: number[] } {
  const maxima: number[] = [];
  const minima: number[] = [];
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > data[i - 1] && data[i] > data[i + 1]) maxima.push(i);
    if (data[i] < data[i - 1] && data[i] < data[i + 1]) minima.push(i);
  }
  return { maxima, minima };
}

function cubicSplineInterpolate(x: number[], y: number[], xNew: number): number {
  if (x.length < 2) return y[0] || 0;
  for (let i = 0; i < x.length - 1; i++) {
    if (xNew >= x[i] && xNew <= x[i + 1]) {
      const t = (xNew - x[i]) / (x[i + 1] - x[i]);
      return y[i] + t * (y[i + 1] - y[i]);
    }
  }
  return y[y.length - 1];
}

function empiricalModeDecomposition(closes: number[], series: TokenSeries, numIMFs: number): { signal: number; trend: number } | null {
  if (closes.length < 10) return null;
  
  let residual = [...closes];
  const imfs: number[][] = [];
  
  for (let imf = 0; imf < numIMFs; imf++) {
    let h = [...residual];
    
    for (let iter = 0; iter < 10; iter++) {
      const { maxima, minima } = findExtrema(h);
      if (maxima.length < 2 || minima.length < 2) break;
      
      const maxX = maxima;
      const maxY = maxima.map(i => h[i]);
      const minX = minima;
      const minY = minima.map(i => h[i]);
      
      const upper: number[] = [];
      const lower: number[] = [];
      for (let i = 0; i < h.length; i++) {
        upper.push(cubicSplineInterpolate(maxX, maxY, i));
        lower.push(cubicSplineInterpolate(minX, minY, i));
      }
      
      const mean = upper.map((u, i) => (u + lower[i]) / 2);
      h = h.map((val, i) => val - mean[i]);
    }
    
    imfs.push(h);
    residual = residual.map((r, i) => r - h[i]);
  }
  
  series.imfs = imfs;
  
  const highFreqEnergy = imfs[0] ? imfs[0].reduce((a, b) => a + Math.abs(b), 0) : 0;
  const trend = residual[residual.length - 1] - residual[residual.length - 2];
  
  return { signal: highFreqEnergy / closes.length, trend };
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], imfs: [] });
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

export interface StratIter106BParams extends StrategyParams {
  num_imfs: number;
  energy_threshold: number;
  trend_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter106BStrategy extends BaseIterStrategy<StratIter106BParams> {
  constructor(params: Partial<StratIter106BParams> = {}) {
    super('strat_iter106_b.params.json', {
      num_imfs: 3,
      energy_threshold: 0.01,
      trend_threshold: 0.005,
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
    const emdResult = empiricalModeDecomposition(series.closes, series, this.params.num_imfs);

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

    if (shouldSkipPrice(bar.close) || !sr || !emdResult) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const lowNoise = emdResult.signal < this.params.energy_threshold;
    const trendUp = emdResult.trend > this.params.trend_threshold;

    if (nearSupport && stochOversold && lowNoise && trendUp) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
