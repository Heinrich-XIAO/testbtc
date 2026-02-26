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

function findLowVolumeNodes(closes: number[], highs: number[], lows: number[], lookback: number, binCount: number, nodeThreshold: number): number[] | null {
  if (closes.length < lookback) return null;
  const recentCloses = closes.slice(-lookback);
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback);
  
  const minPrice = Math.min(...recentLows);
  const maxPrice = Math.max(...recentHighs);
  if (maxPrice === minPrice) return null;
  
  const binSize = (maxPrice - minPrice) / binCount;
  const bins: number[] = new Array(binCount).fill(0);
  
  for (let i = 0; i < recentCloses.length; i++) {
    const avgPrice = (recentHighs[i] + recentLows[i] + recentCloses[i]) / 3;
    const binIndex = Math.min(Math.floor((avgPrice - minPrice) / binSize), binCount - 1);
    bins[binIndex]++;
  }
  
  const avgCount = bins.reduce((a, b) => a + b, 0) / bins.length;
  const threshold = avgCount * nodeThreshold;
  
  const nodePrices: number[] = [];
  for (let i = 0; i < bins.length; i++) {
    if (bins[i] <= threshold && bins[i] > 0) {
      nodePrices.push(minPrice + (i + 0.5) * binSize);
    }
  }
  
  return nodePrices;
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

export interface StratIter124DParams extends StrategyParams {
  lvn_lookback: number;
  lvn_bins: number;
  lvn_threshold: number;
  lvn_tolerance: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter124DStrategy extends BaseIterStrategy<StratIter124DParams> {
  constructor(params: Partial<StratIter124DParams> = {}) {
    super('strat_iter124_d.params.json', {
      lvn_lookback: 30,
      lvn_bins: 15,
      lvn_threshold: 0.5,
      lvn_tolerance: 0.02,
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

    const lvns = findLowVolumeNodes(series.closes, series.highs, series.lows, this.params.lvn_lookback, this.params.lvn_bins, this.params.lvn_threshold);
    if (lvns === null || lvns.length === 0) return;

    const nearLVN = lvns.some(lvn => Math.abs(bar.close - lvn) / lvn <= this.params.lvn_tolerance);
    if (nearLVN) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;

    if (nearSupport && stochOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
