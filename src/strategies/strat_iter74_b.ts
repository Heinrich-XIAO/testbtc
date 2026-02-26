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

function createHistogram(prices: number[], binCount: number): number[] {
  if (prices.length === 0) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  if (range < 0.0000001) {
    const hist = new Array(binCount).fill(0);
    hist[Math.floor(binCount / 2)] = prices.length;
    return hist;
  }
  const hist = new Array(binCount).fill(0);
  for (const p of prices) {
    const idx = Math.min(Math.floor(((p - min) / range) * binCount), binCount - 1);
    hist[idx]++;
  }
  return hist;
}

function normalizeHistogram(hist: number[]): number[] {
  const sum = hist.reduce((s, v) => s + v, 0);
  if (sum === 0) return hist.map(() => 0);
  return hist.map(v => v / sum);
}

function klDivergence(p: number[], q: number[]): number {
  let kl = 0;
  const epsilon = 1e-10;
  for (let i = 0; i < p.length; i++) {
    if (p[i] > 0) {
      kl += p[i] * Math.log((p[i] + epsilon) / (q[i] + epsilon));
    }
  }
  return kl;
}

function jsDivergence(pricesRecent: number[], pricesBaseline: number[], binCount: number): number | null {
  if (pricesRecent.length === 0 || pricesBaseline.length === 0) return null;
  const allPrices = [...pricesRecent, ...pricesBaseline];
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  const range = max - min;
  if (range < 0.0000001) return 0;
  
  const histP = new Array(binCount).fill(0);
  const histQ = new Array(binCount).fill(0);
  
  for (const p of pricesRecent) {
    const idx = Math.min(Math.floor(((p - min) / range) * binCount), binCount - 1);
    histP[idx]++;
  }
  for (const p of pricesBaseline) {
    const idx = Math.min(Math.floor(((p - min) / range) * binCount), binCount - 1);
    histQ[idx]++;
  }
  
  const P = normalizeHistogram(histP);
  const Q = normalizeHistogram(histQ);
  
  const M = P.map((p, i) => 0.5 * (p + Q[i]));
  
  const js = 0.5 * klDivergence(P, M) + 0.5 * klDivergence(Q, M);
  return js;
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

export interface StratIter74BParams extends StrategyParams {
  recent_window: number;
  baseline_window: number;
  bin_count: number;
  js_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter74BStrategy extends BaseIterStrategy<StratIter74BParams> {
  constructor(params: Partial<StratIter74BParams> = {}) {
    super('strat_iter74_b.params.json', {
      recent_window: 20,
      baseline_window: 80,
      bin_count: 8,
      js_threshold: 0.15,
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
    if (series.closes.length < this.params.baseline_window) return;

    const pricesRecent = series.closes.slice(-this.params.recent_window);
    const pricesBaseline = series.closes.slice(-this.params.baseline_window, -this.params.recent_window);

    const js = jsDivergence(pricesRecent, pricesBaseline, this.params.bin_count);

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const lowJs = js !== null && js < this.params.js_threshold;

    if (nearSupport && stochOversold && lowJs) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
