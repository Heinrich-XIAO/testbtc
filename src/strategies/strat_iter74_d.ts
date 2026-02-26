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

function createHistogram(values: number[], binCount: number): number[] {
  if (values.length === 0) return new Array(binCount).fill(0);
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  
  if (range === 0) {
    const hist = new Array(binCount).fill(0);
    hist[0] = values.length;
    return hist;
  }
  
  const hist = new Array(binCount).fill(0);
  const binWidth = range / binCount;
  
  for (const v of values) {
    let binIndex = Math.floor((v - min) / binWidth);
    if (binIndex >= binCount) binIndex = binCount - 1;
    hist[binIndex]++;
  }
  
  return hist;
}

function normalizeHistogram(hist: number[]): number[] {
  const sum = hist.reduce((a, b) => a + b, 0);
  if (sum === 0) return hist.map(() => 0);
  return hist.map(v => v / sum);
}

function bhattacharyyaCoefficient(p: number[], q: number[]): number {
  if (p.length !== q.length) return 0;
  
  let bc = 0;
  for (let i = 0; i < p.length; i++) {
    bc += Math.sqrt(p[i] * q[i]);
  }
  
  return bc;
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

export interface StratIter74DParams extends StrategyParams {
  recent_window: number;
  baseline_window: number;
  bin_count: number;
  bc_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter74DStrategy extends BaseIterStrategy<StratIter74DParams> {
  constructor(params: Partial<StratIter74DParams> = {}) {
    super('strat_iter74_d.params.json', {
      recent_window: 20,
      baseline_window: 80,
      bin_count: 7,
      bc_threshold: 0.7,
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

    if (shouldSkipPrice(bar.close) || !sr) return;
    if (series.closes.length < this.params.baseline_window + 1) return;

    const recentPrices = series.closes.slice(-(this.params.recent_window + 1), -1);
    const baselinePrices = series.closes.slice(-(this.params.baseline_window + 1), -1);
    
    if (recentPrices.length < this.params.recent_window) return;
    
    const recentHist = createHistogram(recentPrices, this.params.bin_count);
    const baselineHist = createHistogram(baselinePrices, this.params.bin_count);
    
    const recentNorm = normalizeHistogram(recentHist);
    const baselineNorm = normalizeHistogram(baselineHist);
    
    const bc = bhattacharyyaCoefficient(recentNorm, baselineNorm);
    
    const highOverlap = bc >= this.params.bc_threshold;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const nearSupport = bar.low <= sr.support * 1.015;

    if (highOverlap && stochOversold && nearSupport) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
