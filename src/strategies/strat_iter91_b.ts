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

function findDominantHarmonics(data: number[], numHarmonics: number): { freq: number; amplitude: number }[] {
  const n = data.length;
  if (n < 4) return [];
  
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const detrended = data.map(x => x - mean);
  
  const { real, imag } = fft(detrended);
  const harmonics: { freq: number; amplitude: number }[] = [];
  
  for (let i = 1; i < Math.floor(n / 2); i++) {
    const amplitude = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]) / n;
    harmonics.push({ freq: i, amplitude });
  }
  
  harmonics.sort((a, b) => b.amplitude - a.amplitude);
  return harmonics.slice(0, numHarmonics);
}

function reconstructSignal(data: number[], harmonics: { freq: number; amplitude: number }[]): number[] {
  const n = data.length;
  if (n === 0 || harmonics.length === 0) return data;
  
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const { real, imag } = fft(data.map(x => x - mean));
  
  const filteredReal = new Array(real.length).fill(0);
  const filteredImag = new Array(imag.length).fill(0);
  
  for (const h of harmonics) {
    if (h.freq < real.length) {
      filteredReal[h.freq] = real[h.freq];
      filteredImag[h.freq] = imag[h.freq];
      const mirrorIdx = real.length - h.freq;
      if (mirrorIdx < real.length && mirrorIdx !== h.freq) {
        filteredReal[mirrorIdx] = real[mirrorIdx];
        filteredImag[mirrorIdx] = imag[mirrorIdx];
      }
    }
  }
  
  const reconstructed: number[] = [];
  for (let i = 0; i < n; i++) {
    let sum = mean;
    for (const h of harmonics) {
      if (h.freq < real.length) {
        const angle = (2 * Math.PI * h.freq * i) / real.length;
        sum += h.amplitude * Math.cos(angle + Math.atan2(filteredImag[h.freq], filteredReal[h.freq]));
      }
    }
    reconstructed.push(sum);
  }
  
  return reconstructed;
}

function findHarmonicLow(reconstructed: number[], lookback: number): boolean {
  if (reconstructed.length < lookback + 2) return false;
  
  const current = reconstructed[reconstructed.length - 1];
  const recent = reconstructed.slice(-(lookback + 2));
  
  let localMinCount = 0;
  for (let i = 1; i < recent.length - 1; i++) {
    if (recent[i] < recent[i - 1] && recent[i] < recent[i + 1]) {
      localMinCount++;
    }
  }
  
  const isNearLow = current <= Math.min(...recent.slice(-3));
  return isNearLow || localMinCount >= 1;
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

export interface StratIter91BParams extends StrategyParams {
  fft_window: number;
  num_harmonics: number;
  harmonic_lookback: number;
  min_harmonic_strength: number;
  stoch_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter91BStrategy extends BaseIterStrategy<StratIter91BParams> {
  private harmonics: Map<string, { freq: number; amplitude: number }[]> = new Map();

  constructor(params: Partial<StratIter91BParams> = {}) {
    super('strat_iter91_b.params.json', {
      fft_window: 64,
      num_harmonics: 3,
      harmonic_lookback: 5,
      min_harmonic_strength: 0.005,
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
    
    if (barNum % 5 === 0 || !this.harmonics.has(bar.tokenId)) {
      const found = findDominantHarmonics(window, this.params.num_harmonics);
      this.harmonics.set(bar.tokenId, found);
    }
    
    const currentHarmonics = this.harmonics.get(bar.tokenId)!;
    
    if (currentHarmonics.length < 2) return;
    
    const strongHarmonics = currentHarmonics.filter(h => h.amplitude >= this.params.min_harmonic_strength);
    if (strongHarmonics.length < 1) return;
    
    const reconstructed = reconstructSignal(window, strongHarmonics);
    const isHarmonicLow = findHarmonicLow(reconstructed, this.params.harmonic_lookback);
    
    const stochOversold = k < this.params.stoch_oversold;

    if (isHarmonicLow && stochOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
