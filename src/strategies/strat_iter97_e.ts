import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  weights: number[];
  validationLosses: number[];
  bestWeights: number[];
  patience: number;
  noImprovementCount: number;
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

function earlyStoppingSignal(closes: number[], series: TokenSeries, lookback: number, patienceMax: number): { signal: number; stopped: boolean } | null {
  if (closes.length < lookback + 10) return null;
  
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  
  if (series.weights.length === 0) {
    for (let i = 0; i < lookback; i++) {
      series.weights.push(1 / lookback);
      series.bestWeights.push(1 / lookback);
    }
    series.patience = patienceMax;
  }
  
  const trainFeatures: number[] = [];
  for (let i = 0; i < lookback; i++) {
    const idx = returns.length - 2 - i;
    trainFeatures.push(idx >= 0 ? returns[idx] : 0);
  }
  
  const valFeatures: number[] = [];
  for (let i = 0; i < lookback; i++) {
    const idx = returns.length - 1 - i;
    valFeatures.push(idx >= 0 ? returns[idx] : 0);
  }
  
  let prediction = 0;
  for (let i = 0; i < lookback; i++) {
    prediction += series.weights[i] * valFeatures[i];
  }
  
  const valLoss = Math.abs(returns[returns.length - 1] - prediction);
  series.validationLosses.push(valLoss);
  if (series.validationLosses.length > 20) series.validationLosses.shift();
  
  const avgValLoss = series.validationLosses.reduce((a, b) => a + b, 0) / series.validationLosses.length;
  const bestLoss = Math.min(...series.validationLosses.slice(0, -1));
  
  if (valLoss < bestLoss * 0.99) {
    series.noImprovementCount = 0;
    for (let i = 0; i < lookback; i++) {
      series.bestWeights[i] = series.weights[i];
    }
  } else {
    series.noImprovementCount++;
  }
  
  let stopped = false;
  if (series.noImprovementCount >= series.patience) {
    stopped = true;
    for (let i = 0; i < lookback; i++) {
      series.weights[i] = series.bestWeights[i];
    }
    series.noImprovementCount = 0;
    series.patience = Math.max(3, Math.floor(patienceMax / 2));
  }
  
  const learningRate = 0.01;
  const trainPrediction = series.weights.reduce((sum, w, i) => sum + w * trainFeatures[i], 0);
  const trainError = returns[returns.length - 2] - trainPrediction;
  for (let i = 0; i < lookback; i++) {
    series.weights[i] += learningRate * trainError * trainFeatures[i];
    series.weights[i] = Math.max(-1, Math.min(1, series.weights[i]));
  }
  
  return { signal: prediction, stopped };
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], weights: [], validationLosses: [], bestWeights: [], patience: 5, noImprovementCount: 0 });
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

export interface StratIter97EParams extends StrategyParams {
  lookback: number;
  patience: number;
  signal_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter97EStrategy extends BaseIterStrategy<StratIter97EParams> {
  constructor(params: Partial<StratIter97EParams> = {}) {
    super('strat_iter97_e.params.json', {
      lookback: 5,
      patience: 5,
      signal_threshold: 0.008,
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
    const esResult = earlyStoppingSignal(series.closes, series, this.params.lookback, this.params.patience);

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

    if (shouldSkipPrice(bar.close) || !sr || !esResult) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const esBuy = esResult.signal > this.params.signal_threshold;

    if (nearSupport && stochOversold && esBuy) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}