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

function computeReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  return returns;
}

function gaussian(x: number, mean: number, variance: number): number {
  if (variance <= 0) return 0;
  const coef = 1 / Math.sqrt(2 * Math.PI * variance);
  const exp = Math.exp(-Math.pow(x - mean, 2) / (2 * variance));
  return coef * exp;
}

interface GMMResult {
  means: number[];
  variances: number[];
  weights: number[];
  responsibilities: number[][];
}

function fitGMM(returns: number[], nComponents: number, maxIterations: number): GMMResult | null {
  if (returns.length < nComponents * 2) return null;
  
  const n = returns.length;
  const sortedReturns = [...returns].sort((a, b) => a - b);
  
  const means: number[] = [];
  const step = Math.floor(n / nComponents);
  for (let i = 0; i < nComponents; i++) {
    const idx = Math.min(i * step + Math.floor(step / 2), n - 1);
    means.push(sortedReturns[idx]);
  }
  
  let variance = 0;
  const globalMean = returns.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) {
    variance += Math.pow(returns[i] - globalMean, 2);
  }
  variance = Math.max(variance / n, 1e-10);
  
  const variances: number[] = Array(nComponents).fill(variance);
  const weights: number[] = Array(nComponents).fill(1 / nComponents);
  const responsibilities: number[][] = Array(n).fill(null).map(() => Array(nComponents).fill(0));
  
  for (let iter = 0; iter < maxIterations; iter++) {
    for (let i = 0; i < n; i++) {
      let total = 0;
      for (let k = 0; k < nComponents; k++) {
        responsibilities[i][k] = weights[k] * gaussian(returns[i], means[k], variances[k]);
        total += responsibilities[i][k];
      }
      if (total > 0) {
        for (let k = 0; k < nComponents; k++) {
          responsibilities[i][k] /= total;
        }
      }
    }
    
    for (let k = 0; k < nComponents; k++) {
      let nk = 0;
      for (let i = 0; i < n; i++) {
        nk += responsibilities[i][k];
      }
      
      if (nk > 1e-10) {
        let newMean = 0;
        for (let i = 0; i < n; i++) {
          newMean += responsibilities[i][k] * returns[i];
        }
        means[k] = newMean / nk;
        
        let newVariance = 0;
        for (let i = 0; i < n; i++) {
          newVariance += responsibilities[i][k] * Math.pow(returns[i] - means[k], 2);
        }
        variances[k] = Math.max(newVariance / nk, 1e-10);
        weights[k] = nk / n;
      }
    }
  }
  
  return { means, variances, weights, responsibilities };
}

function assignComponent(currentReturn: number, gmm: GMMResult): number {
  let maxResp = -1;
  let bestComponent = 0;
  
  for (let k = 0; k < gmm.means.length; k++) {
    const prob = gmm.weights[k] * gaussian(currentReturn, gmm.means[k], gmm.variances[k]);
    if (prob > maxResp) {
      maxResp = prob;
      bestComponent = k;
    }
  }
  
  return bestComponent;
}

function findOversoldComponent(gmm: GMMResult): number {
  let minMean = Infinity;
  let oversoldComponent = 0;
  
  for (let k = 0; k < gmm.means.length; k++) {
    if (gmm.means[k] < minMean) {
      minMean = gmm.means[k];
      oversoldComponent = k;
    }
  }
  
  return oversoldComponent;
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

export interface StratIter81DParams extends StrategyParams {
  n_components: number;
  window_size: number;
  em_iterations: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter81DStrategy extends BaseIterStrategy<StratIter81DParams> {
  constructor(params: Partial<StratIter81DParams> = {}) {
    super('strat_iter81_d.params.json', {
      n_components: 2,
      window_size: 40,
      em_iterations: 10,
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

    let inOversoldComponent = false;
    if (series.closes.length >= this.params.window_size + 1) {
      const windowCloses = series.closes.slice(-this.params.window_size - 1);
      const returns = computeReturns(windowCloses);
      
      const gmm = fitGMM(returns, this.params.n_components, this.params.em_iterations);
      if (gmm) {
        const currentReturn = (series.closes[series.closes.length - 1] - series.closes[series.closes.length - 2]) / series.closes[series.closes.length - 2];
        const assignedComponent = assignComponent(currentReturn, gmm);
        const oversoldComponent = findOversoldComponent(gmm);
        inOversoldComponent = assignedComponent === oversoldComponent;
      }
    }

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

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;

    if (nearSupport && stochOversold && inOversoldComponent) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
