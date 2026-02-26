import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter92BParams extends StrategyParams {
  kernel_bandwidth: number;
  kernel_lookback: number;
  prediction_threshold: number;
  stoch_oversold: number;
  stoch_k_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter92BParams = {
  kernel_bandwidth: 0.15,
  kernel_lookback: 40,
  prediction_threshold: 0.012,
  stoch_oversold: 16,
  stoch_k_period: 14,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter92BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter92_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function gaussianKernel(u: number, bandwidth: number): number {
  return Math.exp(-0.5 * Math.pow(u / bandwidth, 2)) / (bandwidth * Math.sqrt(2 * Math.PI));
}

function nadarayaWatsonRegression(x: number[], y: number[], queryPoint: number, bandwidth: number): number | null {
  if (x.length < 3) return null;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < x.length; i++) {
    const weight = gaussianKernel(x[i] - queryPoint, bandwidth);
    numerator += weight * y[i];
    denominator += weight;
  }
  
  if (denominator < 0.0001) return null;
  return numerator / denominator;
}

function kernelRegressionPredict(closes: number[], lookback: number, bandwidth: number): { prediction: number; derivative: number } | null {
  if (closes.length < lookback + 1) return null;
  
  const recentCloses = closes.slice(-lookback);
  const x: number[] = recentCloses.map((_, i) => i);
  const y: number[] = recentCloses;
  
  const queryPoint = lookback - 1;
  const prediction = nadarayaWatsonRegression(x, y, queryPoint, bandwidth);
  
  const prevPrediction = nadarayaWatsonRegression(x, y, queryPoint - 1, bandwidth);
  
  if (prediction === null || prevPrediction === null) return null;
  
  const derivative = prediction - prevPrediction;
  
  return { prediction, derivative };
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

export class StratIter92BStrategy implements Strategy {
  params: StratIter92BParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private derivatives: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter92BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter92BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.derivatives.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const derivatives = this.derivatives.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    capPush(closes, bar.close);
    capPush(highs, bar.high);
    capPush(lows, bar.low);

    const kr = kernelRegressionPredict(closes, this.params.kernel_lookback, this.params.kernel_bandwidth);
    if (kr !== null) {
      capPush(derivatives, kr.derivative);
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
    if (kVals.length < 3 || derivatives.length < 2) return;

    const currK = kVals[kVals.length - 1];
    const prevK = kVals[kVals.length - 2];
    const kRising = currK > prevK + 1;
    const oversold = currK <= this.params.stoch_oversold;

    const currDeriv = derivatives[derivatives.length - 1];
    const prevDeriv = derivatives[derivatives.length - 2];
    const derivativeTurningUp = currDeriv > prevDeriv && currDeriv > this.params.prediction_threshold;

    const nearSupport = bar.close <= sr.support * 1.02;

    if (kRising && oversold && derivativeTurningUp && nearSupport) {
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
