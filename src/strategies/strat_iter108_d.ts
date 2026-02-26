import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  pageRanks: number[];
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

function pageRankSignal(closes: number[], series: TokenSeries, windowSize: number, damping: number, iterations: number): { signal: number; rank: number } | null {
  if (closes.length < windowSize) return null;
  
  const window = closes.slice(-windowSize);
  const n = window.length;
  
  const adj: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < n - 1; i++) {
    const weight = Math.abs(window[i + 1] - window[i]);
    adj[i][i + 1] = weight;
    adj[i + 1][i] = weight;
  }
  
  const outDegree: number[] = [];
  for (let i = 0; i < n; i++) {
    outDegree[i] = adj[i].reduce((a, b) => a + b, 0) || 1;
  }
  
  let ranks: number[] = Array(n).fill(1 / n);
  
  for (let iter = 0; iter < iterations; iter++) {
    const newRanks: number[] = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        if (adj[j][i] > 0) {
          sum += ranks[j] * adj[j][i] / outDegree[j];
        }
      }
      newRanks.push((1 - damping) / n + damping * sum);
    }
    ranks = newRanks;
  }
  
  series.pageRanks = ranks.slice(-5);
  
  const currentRank = ranks[ranks.length - 1];
  const prevRank = ranks.length > 1 ? ranks[ranks.length - 2] : currentRank;
  
  const signal = (currentRank - prevRank) / (prevRank || 0.001);
  
  return { signal, rank: currentRank };
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], pageRanks: [] });
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

export interface StratIter108DParams extends StrategyParams {
  window_size: number;
  damping: number;
  iterations: number;
  rank_threshold: number;
  signal_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter108DStrategy extends BaseIterStrategy<StratIter108DParams> {
  constructor(params: Partial<StratIter108DParams> = {}) {
    super('strat_iter108_d.params.json', {
      window_size: 10,
      damping: 0.85,
      iterations: 10,
      rank_threshold: 0.1,
      signal_threshold: 0.5,
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
    const prResult = pageRankSignal(series.closes, series, this.params.window_size, this.params.damping, this.params.iterations);

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

    if (shouldSkipPrice(bar.close) || !sr || !prResult) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const highRank = prResult.rank > this.params.rank_threshold;
    const signalUp = prResult.signal > this.params.signal_threshold;

    if (nearSupport && stochOversold && highRank && signalUp) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
