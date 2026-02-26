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

function computeDFT(prices: number[]): { magnitudes: number[]; phases: number[] } {
  const N = prices.length;
  const magnitudes: number[] = [];
  const phases: number[] = [];
  
  const mean = prices.reduce((s, v) => s + v, 0) / N;
  const detrended = prices.map(p => p - mean);
  
  for (let k = 0; k < Math.floor(N / 2); k++) {
    let real = 0;
    let imag = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      real += detrended[n] * Math.cos(angle);
      imag -= detrended[n] * Math.sin(angle);
    }
    const magnitude = Math.sqrt(real * real + imag * imag);
    const phase = Math.atan2(imag, real);
    magnitudes.push(magnitude);
    phases.push(phase);
  }
  
  return { magnitudes, phases };
}

function findResonantFrequency(
  magnitudes: number[],
  minCycleIdx: number,
  maxCycleIdx: number
): { dominantIdx: number; resonanceStrength: number } {
  let maxMag = 0;
  let dominantIdx = 1;
  let totalMag = 0;
  
  const startIdx = Math.max(1, minCycleIdx);
  const endIdx = Math.min(magnitudes.length - 1, maxCycleIdx);
  
  for (let k = startIdx; k <= endIdx; k++) {
    totalMag += magnitudes[k];
    if (magnitudes[k] > maxMag) {
      maxMag = magnitudes[k];
      dominantIdx = k;
    }
  }
  
  const resonanceStrength = totalMag > 0 ? maxMag / totalMag : 0;
  
  return { dominantIdx, resonanceStrength };
}

function getResonanceTrough(
  prices: number[],
  windowSize: number,
  minPeriod: number,
  maxPeriod: number
): { phase: number; cycleLength: number; isTrough: boolean; resonanceStrength: number } | null {
  if (prices.length < windowSize) return null;
  
  const window = prices.slice(-windowSize);
  const { magnitudes, phases } = computeDFT(window);
  
  if (magnitudes.length === 0) return null;
  
  const minCycleIdx = Math.floor(windowSize / maxPeriod);
  const maxCycleIdx = Math.floor(windowSize / minPeriod);
  
  const { dominantIdx, resonanceStrength } = findResonantFrequency(magnitudes, minCycleIdx, maxCycleIdx);
  
  if (dominantIdx <= 0) return null;
  
  const cycleLength = Math.round(windowSize / dominantIdx);
  const currentPhase = phases[dominantIdx];
  
  const normalizedPhase = ((currentPhase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  
  const isTrough = normalizedPhase > Math.PI * 0.6 && normalizedPhase < Math.PI * 1.4;
  
  return { phase: normalizedPhase, cycleLength, isTrough, resonanceStrength };
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

export interface StratIter86BParams extends StrategyParams {
  window_size: number;
  min_period: number;
  max_period: number;
  stoch_oversold: number;
  stoch_k_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const STOCH_K_PERIOD = 14;

export class StratIter86BStrategy extends BaseIterStrategy<StratIter86BParams> {
  private kVals: Map<string, number[]> = new Map();
  private resonanceInfo: Map<string, { phase: number; cycleLength: number; isTrough: boolean; resonanceStrength: number } | null> = new Map();

  constructor(params: Partial<StratIter86BParams> = {}) {
    super('strat_iter86_b.params.json', {
      window_size: 48,
      min_period: 8,
      max_period: 30,
      stoch_oversold: 16,
      stoch_k_period: STOCH_K_PERIOD,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const resonanceData = getResonanceTrough(
      series.closes,
      this.params.window_size,
      this.params.min_period,
      this.params.max_period
    );
    this.resonanceInfo.set(bar.tokenId, resonanceData);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || !resonanceData) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = kv[kv.length - 1] < this.params.stoch_oversold;
    const atResonanceTrough = resonanceData.isTrough && resonanceData.resonanceStrength > 0.1;

    if (nearSupport && stochOversold && atResonanceTrough) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export default StratIter86BStrategy;
