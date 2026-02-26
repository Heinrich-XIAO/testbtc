import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  macdHistogram: number[];
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

function calculateEMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
  }
  return ema;
}

function calculateMACD(closes: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number): { histogram: number } | null {
  if (closes.length < slowPeriod + signalPeriod) return null;
  
  const fastEMA: number[] = [];
  const slowEMA: number[] = [];
  const macdLine: number[] = [];
  
  for (let i = slowPeriod; i <= closes.length; i++) {
    const fast = calculateEMA(closes.slice(0, i), fastPeriod);
    const slow = calculateEMA(closes.slice(0, i), slowPeriod);
    if (fast !== null && slow !== null) {
      macdLine.push(fast - slow);
    }
  }
  
  if (macdLine.length < signalPeriod) return null;
  
  const signal = calculateEMA(macdLine, signalPeriod);
  if (signal === null) return null;
  
  return { histogram: macdLine[macdLine.length - 1] - signal };
}

function detectMACDDivergence(closes: number[], histogram: number[], lookback: number): { bullish: boolean } {
  if (closes.length < lookback || histogram.length < lookback) return { bullish: false };
  
  const recentCloses = closes.slice(-lookback);
  const recentHist = histogram.slice(-lookback);
  
  let priceLowerLow = false;
  let histHigherLow = false;
  
  for (let i = 1; i < recentCloses.length - 1; i++) {
    if (recentCloses[i] < recentCloses[i - 1] && recentCloses[i] < recentCloses[i + 1]) {
      if (recentCloses[i] < recentCloses[0]) priceLowerLow = true;
    }
  }
  
  for (let i = 1; i < recentHist.length - 1; i++) {
    if (recentHist[i] < recentHist[i - 1] && recentHist[i] < recentHist[i + 1]) {
      if (recentHist[i] > recentHist[0] * 0.9) histHigherLow = true;
    }
  }
  
  return { bullish: priceLowerLow && histHigherLow };
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], macdHistogram: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    
    const macd = calculateMACD(s.closes, 12, 26, 9);
    if (macd !== null) capPush(s.macdHistogram, macd.histogram);
    
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

export interface StratIter120BParams extends StrategyParams {
  divergence_lookback: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter120BStrategy extends BaseIterStrategy<StratIter120BParams> {
  constructor(params: Partial<StratIter120BParams> = {}) {
    super('strat_iter120_b.params.json', {
      divergence_lookback: 14,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    const divergence = detectMACDDivergence(series.closes, series.macdHistogram, this.params.divergence_lookback);

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

    if (shouldSkipPrice(bar.close) || series.macdHistogram.length < this.params.divergence_lookback) return;

    const stochOversold = k !== null && k < this.params.stoch_oversold;

    if (stochOversold && divergence.bullish) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
