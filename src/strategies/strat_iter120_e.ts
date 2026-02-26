import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  rsi: number[];
  macdHistogram: number[];
  stochK: number[];
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

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function calculateRSI(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function calculateEMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
  }
  return ema;
}

function calculateMACDHistogram(closes: number[]): number | null {
  if (closes.length < 35) return null;
  const fastEMA: number[] = [];
  const slowEMA: number[] = [];
  const macdLine: number[] = [];
  
  for (let i = 26; i <= closes.length; i++) {
    const fast = calculateEMA(closes.slice(0, i), 12);
    const slow = calculateEMA(closes.slice(0, i), 26);
    if (fast !== null && slow !== null) {
      macdLine.push(fast - slow);
    }
  }
  
  if (macdLine.length < 9) return null;
  const signal = calculateEMA(macdLine, 9);
  if (signal === null) return null;
  return macdLine[macdLine.length - 1] - signal;
}

function detectBullishDivergence(closes: number[], indicator: number[], lookback: number): boolean {
  if (closes.length < lookback || indicator.length < lookback) return false;
  
  const recentCloses = closes.slice(-lookback);
  const recentInd = indicator.slice(-lookback);
  
  let priceLowerLow = false;
  let indHigherLow = false;
  
  for (let i = 1; i < recentCloses.length - 1; i++) {
    if (recentCloses[i] < recentCloses[i - 1] && recentCloses[i] < recentCloses[i + 1]) {
      if (recentCloses[i] < recentCloses[0]) priceLowerLow = true;
    }
  }
  
  for (let i = 1; i < recentInd.length - 1; i++) {
    if (recentInd[i] < recentInd[i - 1] && recentInd[i] < recentInd[i + 1]) {
      if (recentInd[i] > recentInd[0] * 0.9) indHigherLow = true;
    }
  }
  
  return priceLowerLow && indHigherLow;
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], rsi: [], macdHistogram: [], stochK: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    
    const rsi = calculateRSI(s.closes, 14);
    if (rsi !== null) capPush(s.rsi, rsi);
    
    const macdHist = calculateMACDHistogram(s.closes);
    if (macdHist !== null) capPush(s.macdHistogram, macdHist);
    
    const k = stochK(s.closes, s.highs, s.lows, 14);
    if (k !== null) capPush(s.stochK, k);
    
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

export interface StratIter120EParams extends StrategyParams {
  divergence_lookback: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  min_divergences: number;
}

export class StratIter120EStrategy extends BaseIterStrategy<StratIter120EParams> {
  constructor(params: Partial<StratIter120EParams> = {}) {
    super('strat_iter120_e.params.json', {
      divergence_lookback: 14,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      min_divergences: 2,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = series.stochK.length > 0 ? series.stochK[series.stochK.length - 1] : null;

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
    
    const lb = this.params.divergence_lookback;
    
    let divergenceCount = 0;
    if (series.rsi.length >= lb && detectBullishDivergence(series.closes, series.rsi, lb)) divergenceCount++;
    if (series.macdHistogram.length >= lb && detectBullishDivergence(series.closes, series.macdHistogram, lb)) divergenceCount++;
    if (series.stochK.length >= lb && detectBullishDivergence(series.closes, series.stochK, lb)) divergenceCount++;

    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const hasEnoughDivergences = divergenceCount >= this.params.min_divergences;

    if (stochOversold && hasEnoughDivergences) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
