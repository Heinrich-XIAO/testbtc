import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
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

function fitGPD(exceedances: number[]): { xi: number; beta: number } | null {
  if (exceedances.length < 5) return null;
  
  const n = exceedances.length;
  const sorted = [...exceedances].sort((a, b) => a - b);
  
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  
  const p = 0.5;
  const q = sorted[Math.floor(n * p)];
  if (q === 0) return null;
  
  let xi = 0.5 * (mean / q - 1);
  xi = Math.max(-0.5, Math.min(0.5, xi));
  
  let beta = mean * (1 - xi) / 2;
  beta = Math.max(0.0001, beta);
  
  return { xi, beta };
}

function computeExtremeProbability(threshold: number, exceedances: number[]): number | null {
  if (exceedances.length < 5) return null;
  
  const gpd = fitGPD(exceedances);
  if (!gpd) return null;
  
  const { xi, beta } = gpd;
  
  const n = exceedances.length;
  const totalReturns = Math.floor(n / (1 - 0.90));
  
  const probExceed = n / totalReturns;
  
  const extremeThreshold = threshold * 1.5;
  const z = (extremeThreshold - 0) / beta;
  
  let probExtreme: number;
  if (Math.abs(xi) < 0.001) {
    probExtreme = Math.exp(-z);
  } else {
    const term = 1 + xi * z;
    if (term <= 0) return 1.0;
    probExtreme = Math.pow(term, -1 / xi);
  }
  
  return probExceed * probExtreme;
}

function computeEVTScore(returns: number[], thresholdPct: number): number | null {
  if (returns.length < 20) return null;
  
  const absReturns = returns.map(r => Math.abs(r));
  const sorted = [...absReturns].sort((a, b) => a - b);
  const thresholdIdx = Math.floor(sorted.length * thresholdPct);
  const threshold = sorted[thresholdIdx];
  
  if (threshold <= 0) return null;
  
  const exceedances = absReturns.filter(r => r > threshold).map(r => r - threshold);
  
  return computeExtremeProbability(threshold, exceedances);
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    if (s.closes.length > 0) {
      const ret = (bar.close - s.closes[s.closes.length - 1]) / s.closes[s.closes.length - 1];
      capPush(s.returns, ret);
    }
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

export interface StratIter83CParams extends StrategyParams {
  window_size: number;
  threshold_pct: number;
  prob_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter83CStrategy extends BaseIterStrategy<StratIter83CParams> {
  constructor(params: Partial<StratIter83CParams> = {}) {
    super('strat_iter83_c.params.json', {
      window_size: 40,
      threshold_pct: 0.92,
      prob_threshold: 0.08,
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
    if (series.returns.length < this.params.window_size) return;

    const windowReturns = series.returns.slice(-this.params.window_size);
    const evtScore = computeEVTScore(windowReturns, this.params.threshold_pct);

    if (evtScore === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const elevatedExtremRisk = evtScore >= this.params.prob_threshold;

    if (nearSupport && stochOversold && elevatedExtremRisk) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
