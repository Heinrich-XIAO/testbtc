import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter92EParams extends StrategyParams {
  gp_length_scale: number;
  gp_variance: number;
  gp_lookback: number;
  uncertainty_threshold: number;
  prediction_threshold: number;
  stoch_oversold: number;
  stoch_k_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter92EParams = {
  gp_length_scale: 8,
  gp_variance: 0.01,
  gp_lookback: 30,
  uncertainty_threshold: 0.03,
  prediction_threshold: 0.01,
  stoch_oversold: 16,
  stoch_k_period: 14,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter92EParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter92_e.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function squaredExponentialKernel(x1: number, x2: number, lengthScale: number, variance: number): number {
  return variance * Math.exp(-0.5 * Math.pow((x1 - x2) / lengthScale, 2));
}

function gaussianProcessPredict(closes: number[], lengthScale: number, variance: number, lookback: number): { mean: number; variance: number; slope: number } | null {
  if (closes.length < lookback + 1) return null;
  
  const recentCloses = closes.slice(-lookback);
  const n = recentCloses.length;
  
  const K: number[][] = [];
  for (let i = 0; i < n; i++) {
    K[i] = [];
    for (let j = 0; j < n; j++) {
      K[i][j] = squaredExponentialKernel(i, j, lengthScale, variance);
    }
    K[i][i] += 0.0001;
  }
  
  const kStar: number[] = [];
  const kStarPrev: number[] = [];
  for (let i = 0; i < n; i++) {
    kStar.push(squaredExponentialKernel(i, n, lengthScale, variance));
    kStarPrev.push(squaredExponentialKernel(i, n - 1, lengthScale, variance));
  }
  
  const kStarStar = squaredExponentialKernel(n, n, lengthScale, variance) + 0.0001;
  const kStarStarPrev = squaredExponentialKernel(n - 1, n - 1, lengthScale, variance) + 0.0001;
  
  const mean = recentCloses.reduce((a, b) => a + b, 0) / n;
  const normalizedY = recentCloses.map(y => y - mean);
  
  const alpha: number[] = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += K[i][j] * normalizedY[j];
    }
    alpha.push(sum);
  }
  
  let predMean = 0;
  for (let i = 0; i < n; i++) {
    predMean += kStar[i] * alpha[i];
  }
  predMean += mean;
  
  let predVariance = kStarStar;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += K[i][j] * kStar[j];
    }
    predVariance -= kStar[i] * sum;
  }
  predVariance = Math.max(0.0001, predVariance);
  
  let predMeanPrev = 0;
  for (let i = 0; i < n; i++) {
    predMeanPrev += kStarPrev[i] * alpha[i];
  }
  predMeanPrev += mean;
  
  const slope = predMean - predMeanPrev;
  
  return { mean: predMean, variance: predVariance, slope };
}

function stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period) return null;
  const highSlice = highs.slice(-period);
  const lowSlice = lows.slice(-period);
  const highest = Math.max(...highSlice);
  const lowest = Math.min(...lowSlice);
  if (highest === lowest) return 50;
  return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
}

function supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function capPush<T>(arr: T[], val: T, max = 500): void {
  arr.push(val);
  if (arr.length > max) arr.shift();
}

export class StratIter92EStrategy implements Strategy {
  params: StratIter92EParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private slopes: Map<string, number[]> = new Map();
  private uncertainties: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter92EParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter92EParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.slopes.set(bar.tokenId, []);
      this.uncertainties.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const slopes = this.slopes.get(bar.tokenId)!;
    const uncertainties = this.uncertainties.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    capPush(closes, bar.close);
    capPush(highs, bar.high);
    capPush(lows, bar.low);

    const gp = gaussianProcessPredict(closes, this.params.gp_length_scale, this.params.gp_variance, this.params.gp_lookback);
    if (gp !== null) {
      capPush(slopes, gp.slope);
      capPush(uncertainties, Math.sqrt(gp.variance));
    }

    const k = stochasticK(closes, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      capPush(kVals, k);
    }

    const sr = supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.low <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
        if (bar.high >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (kVals.length < 3 || slopes.length < 2 || uncertainties.length < 1) return;

    const currK = kVals[kVals.length - 1];
    const prevK = kVals[kVals.length - 2];
    const kRising = currK > prevK + 1;
    const oversold = currK <= this.params.stoch_oversold;

    const currSlope = slopes[slopes.length - 1];
    const prevSlope = slopes[slopes.length - 2];
    const slopeTurningUp = currSlope > prevSlope && currSlope > this.params.prediction_threshold;

    const currUncertainty = uncertainties[uncertainties.length - 1];
    const lowUncertainty = currUncertainty < this.params.uncertainty_threshold;

    const nearSupport = bar.close <= sr.support * 1.02;

    if (kRising && oversold && slopeTurningUp && lowUncertainty && nearSupport) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
