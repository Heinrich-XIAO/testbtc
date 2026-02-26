import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  weights: number[];
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [], weights: [] });
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

export interface StratIter81EParams extends StrategyParams {
  n_features: number;
  learning_rate: number;
  prediction_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter81EStrategy extends BaseIterStrategy<StratIter81EParams> {
  constructor(params: Partial<StratIter81EParams> = {}) {
    super('strat_iter81_e.params.json', {
      n_features: 5,
      learning_rate: 0.005,
      prediction_threshold: 0.002,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  private buildFeatures(returns: number[], nFeatures: number): number[] | null {
    if (returns.length < nFeatures + 1) return null;
    const features: number[] = [];
    for (let i = 0; i < nFeatures; i++) {
      features.push(returns[returns.length - 1 - i] || 0);
    }
    const lastRet = returns[returns.length - 1] || 0;
    const prevRet = returns[returns.length - 2] || 0;
    const momentum = lastRet - prevRet;
    features.push(momentum);
    return features;
  }

  private predict(features: number[], weights: number[]): number {
    let prediction = 0;
    for (let i = 0; i < features.length && i < weights.length; i++) {
      prediction += weights[i] * features[i];
    }
    return prediction;
  }

  private onlineUpdate(weights: number[], features: number[], actualReturn: number, learningRate: number): void {
    const prediction = this.predict(features, weights);
    const error = actualReturn - prediction;
    for (let i = 0; i < features.length && i < weights.length; i++) {
      weights[i] += learningRate * error * features[i];
    }
  }

  private initWeights(nFeatures: number): number[] {
    const weights: number[] = [];
    for (let i = 0; i < nFeatures + 1; i++) {
      weights.push(0);
    }
    return weights;
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
    if (series.returns.length < this.params.n_features + 2) return;

    if (series.weights.length === 0) {
      series.weights = this.initWeights(this.params.n_features);
    }

    const nFeatures = this.params.n_features;
    const prevFeatures = this.buildFeatures(series.returns.slice(0, -1), nFeatures);
    if (prevFeatures && series.returns.length > nFeatures + 1) {
      const actualReturn = series.returns[series.returns.length - 1];
      this.onlineUpdate(series.weights, prevFeatures, actualReturn, this.params.learning_rate);
    }

    const features = this.buildFeatures(series.returns, nFeatures);
    if (!features) return;

    const prediction = this.predict(features, series.weights);

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const predictionBullish = prediction > this.params.prediction_threshold;

    if (nearSupport && stochOversold && predictionBullish) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
