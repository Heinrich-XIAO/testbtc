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

function findExtrema(data: number[]): { maxima: number[]; minima: number[] } {
  const maxima: number[] = [];
  const minima: number[] = [];
  
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > data[i - 1] && data[i] > data[i + 1]) {
      maxima.push(i);
    }
    if (data[i] < data[i - 1] && data[i] < data[i + 1]) {
      minima.push(i);
    }
  }
  
  return { maxima, minima };
}

function splineInterpolate(x: number, xData: number[], yData: number[]): number {
  if (xData.length < 2) return yData[0] || 0;
  
  let i = 0;
  while (i < xData.length - 1 && xData[i + 1] < x) i++;
  
  if (i >= xData.length - 1) i = xData.length - 2;
  
  const t = (x - xData[i]) / (xData[i + 1] - xData[i]);
  return yData[i] * (1 - t) + yData[i + 1] * t;
}

function emd(data: number[], maxImfs: number): number[][] {
  const imfs: number[][] = [];
  let residue = [...data];
  
  for (let imfCount = 0; imfCount < maxImfs; imfCount++) {
    if (residue.length < 4) break;
    
    let h = [...residue];
    let prevH = [...h];
    
    for (let s = 0; s < 20; s++) {
      const { maxima, minima } = findExtrema(h);
      
      if (maxima.length < 2 || minima.length < 2) break;
      
      const xMax = maxima;
      const yMax = maxima.map(i => h[i]);
      const xMin = minima;
      const yMin = minima.map(i => h[i]);
      
      const upperEnvelope: number[] = [];
      const lowerEnvelope: number[] = [];
      
      for (let i = 0; i < h.length; i++) {
        upperEnvelope.push(splineInterpolate(i, xMax, yMax));
        lowerEnvelope.push(splineInterpolate(i, xMin, yMin));
      }
      
      const mean = upperEnvelope.map((u, i) => (u + lowerEnvelope[i]) / 2);
      
      prevH = [...h];
      h = h.map((val, i) => val - mean[i]);
      
      const { maxima: newMax, minima: newMin } = findExtrema(h);
      const crossings = newMax.length + newMin.length;
      
      if (crossings >= 2 && Math.abs(h.reduce((a, b) => a + b, 0)) < 0.001 * h.length) {
        break;
      }
    }
    
    const isImf = h.some(v => Math.abs(v) > 1e-10);
    if (isImf) {
      imfs.push(h);
      residue = residue.map((r, i) => r - h[i]);
    } else {
      break;
    }
  }
  
  imfs.push(residue);
  
  return imfs;
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

export interface StratIter91EParams extends StrategyParams {
  emd_window: number;
  max_imfs: number;
  low_freq_imf: number;
  trough_threshold: number;
  stoch_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter91EStrategy extends BaseIterStrategy<StratIter91EParams> {
  private imfHistory: Map<string, number[][]> = new Map();
  private prevImfValue: Map<string, number> = new Map();

  constructor(params: Partial<StratIter91EParams> = {}) {
    super('strat_iter91_e.params.json', {
      emd_window: 40,
      max_imfs: 4,
      low_freq_imf: 2,
      trough_threshold: 0.002,
      stoch_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.16,
      max_hold_bars: 24,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_period);

    if (!this.imfHistory.has(bar.tokenId)) {
      this.imfHistory.set(bar.tokenId, []);
      this.prevImfValue.set(bar.tokenId, 0);
    }

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

    if (shouldSkipPrice(bar.close) || k === null) return;
    if (series.closes.length < this.params.emd_window) return;

    const window = series.closes.slice(-this.params.emd_window);
    const imfs = emd(window, this.params.max_imfs);
    
    if (imfs.length < this.params.low_freq_imf + 1) return;
    
    const lowFreqImf = imfs[Math.min(this.params.low_freq_imf, imfs.length - 1)];
    const currentImfValue = lowFreqImf[lowFreqImf.length - 1];
    const prevImfVal = this.prevImfValue.get(bar.tokenId)!;
    const imfDelta = currentImfValue - prevImfVal;
    this.prevImfValue.set(bar.tokenId, currentImfValue);
    
    let imfTrough = false;
    if (lowFreqImf.length >= 5) {
      const recent = lowFreqImf.slice(-5);
      const minVal = Math.min(...recent);
      imfTrough = Math.abs(currentImfValue - minVal) < Math.abs(currentImfValue) * 0.2 && currentImfValue < 0;
    }
    
    const imfReversing = imfDelta > this.params.trough_threshold && currentImfValue < 0;
    const stochOversold = k < this.params.stoch_oversold;

    if ((imfTrough || imfReversing) && stochOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
