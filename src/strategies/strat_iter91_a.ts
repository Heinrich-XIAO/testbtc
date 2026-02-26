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

function fft(data: number[]): { real: number[]; imag: number[] } {
  const n = data.length;
  if (n === 0) return { real: [], imag: [] };
  
  const paddedLength = Math.pow(2, Math.ceil(Math.log2(n)));
  const padded = new Array(paddedLength).fill(0);
  for (let i = 0; i < n; i++) padded[i] = data[i];
  
  const real = [...padded];
  const imag = new Array(paddedLength).fill(0);
  
  for (let size = 2; size <= paddedLength; size *= 2) {
    const halfSize = size / 2;
    const angle = -2 * Math.PI / size;
    
    for (let i = 0; i < paddedLength; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const cos = Math.cos(angle * j);
        const sin = Math.sin(angle * j);
        const tReal = real[i + j + halfSize] * cos - imag[i + j + halfSize] * sin;
        const tImag = real[i + j + halfSize] * sin + imag[i + j + halfSize] * cos;
        
        real[i + j + halfSize] = real[i + j] - tReal;
        imag[i + j + halfSize] = imag[i + j] - tImag;
        real[i + j] += tReal;
        imag[i + j] += tImag;
      }
    }
  }
  
  return { real, imag };
}

function ifft(real: number[], imag: number[]): number[] {
  const n = real.length;
  if (n === 0) return [];
  
  const conjImag = imag.map(x => -x);
  const { real: resultReal } = fft(real.map((r, i) => r).concat(new Array(n).fill(0)));
  
  const fullReal = [...real];
  const fullImag = [...conjImag];
  
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angle = 2 * Math.PI / size;
    
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const cos = Math.cos(angle * j);
        const sin = Math.sin(angle * j);
        const tReal = fullReal[i + j + halfSize] * cos - fullImag[i + j + halfSize] * sin;
        const tImag = fullReal[i + j + halfSize] * sin + fullImag[i + j + halfSize] * cos;
        
        fullReal[i + j + halfSize] = fullReal[i + j] - tReal;
        fullImag[i + j + halfSize] = fullImag[i + j] - tImag;
        fullReal[i + j] += tReal;
        fullImag[i + j] += tImag;
      }
    }
  }
  
  return fullReal.slice(0, n).map(x => x / n);
}

function lowPassFilter(data: number[], cutoffRatio: number): number[] {
  if (data.length < 4) return data;
  
  const { real, imag } = fft(data);
  const n = real.length;
  const cutoff = Math.floor(n * cutoffRatio);
  
  for (let i = cutoff; i < n - cutoff; i++) {
    real[i] = 0;
    imag[i] = 0;
  }
  
  return ifft(real, imag).slice(0, data.length);
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

export interface StratIter91AParams extends StrategyParams {
  fft_window: number;
  cutoff_ratio: number;
  smooth_threshold: number;
  stoch_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter91AStrategy extends BaseIterStrategy<StratIter91AParams> {
  private smoothedPrices: Map<string, number[]> = new Map();
  private prevSmoothed: Map<string, number> = new Map();

  constructor(params: Partial<StratIter91AParams> = {}) {
    super('strat_iter91_a.params.json', {
      fft_window: 32,
      cutoff_ratio: 0.15,
      smooth_threshold: 0.002,
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

    if (!this.smoothedPrices.has(bar.tokenId)) {
      this.smoothedPrices.set(bar.tokenId, []);
      this.prevSmoothed.set(bar.tokenId, bar.close);
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
    if (series.closes.length < this.params.fft_window) return;

    const window = series.closes.slice(-this.params.fft_window);
    const smoothed = lowPassFilter(window, this.params.cutoff_ratio);
    const currentSmoothed = smoothed[smoothed.length - 1];
    const prevSmooth = this.prevSmoothed.get(bar.tokenId)!;
    
    const smoothDelta = (currentSmoothed - prevSmooth) / prevSmooth;
    this.prevSmoothed.set(bar.tokenId, currentSmoothed);
    
    const smoothedArr = this.smoothedPrices.get(bar.tokenId)!;
    capPush(smoothedArr, currentSmoothed, 100);

    const stochOversold = k < this.params.stoch_oversold;
    const smoothTrough = smoothDelta > -this.params.smooth_threshold;

    if (stochOversold && smoothTrough) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
