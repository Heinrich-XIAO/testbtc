import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter69BParams extends StrategyParams {
  window_size: number;
  latent_dim: number;
  reconstruction_error_threshold: number;
  anomaly_threshold: number;
  stoch_oversold: number;
  stoch_k_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter69BParams = {
  window_size: 20,
  latent_dim: 3,
  reconstruction_error_threshold: 0.06,
  anomaly_threshold: 1.8,
  stoch_oversold: 16,
  stoch_k_period: 14,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter69BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter69_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function simpleAutoencoder(closes: number[], windowSize: number, latentDim: number): { reconstructionError: number; latent: number[] } {
  if (closes.length < windowSize) {
    return { reconstructionError: 0, latent: [] };
  }

  const window = closes.slice(-windowSize);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const std = Math.sqrt(window.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window.length);
  
  if (std < 0.0001) {
    return { reconstructionError: 0, latent: Array(latentDim).fill(mean) };
  }

  const normalized = window.map(v => (v - mean) / std);

  const weightsEncode: number[] = [];
  const weightsDecode: number[] = [];
  for (let i = 0; i < windowSize; i++) {
    weightsEncode.push(sigmoid(i / windowSize - 0.3) * 0.5);
  }
  for (let i = 0; i < latentDim; i++) {
    const latentValue = normalized.slice(i * Math.floor(windowSize / latentDim), (i + 1) * Math.floor(windowSize / latentDim))
      .reduce((a, b) => a + b, 0) / Math.floor(windowSize / latentDim);
    weightsDecode.push(sigmoid(latentValue));
  }

  const reconstructed: number[] = [];
  for (let i = 0; i < windowSize; i++) {
    let val = 0;
    for (let j = 0; j < latentDim; j++) {
      val += normalized[i] * weightsEncode[i % weightsEncode.length] * weightsDecode[j];
    }
    reconstructed.push(val * std + mean);
  }

  let error = 0;
  for (let i = 0; i < windowSize; i++) {
    error += Math.abs(window[i] - reconstructed[i]) / mean;
  }
  const reconstructionError = error / windowSize;

  const latent: number[] = [];
  for (let i = 0; i < latentDim; i++) {
    const start = i * Math.floor(windowSize / latentDim);
    const end = Math.min(start + Math.floor(windowSize / latentDim), windowSize);
    latent.push(normalized.slice(start, end).reduce((a, b) => a + b, 0) / (end - start));
  }

  return { reconstructionError, latent };
}

function computeAnomalyScore(closes: number[], windowSize: number, latentDim: number): number {
  const { reconstructionError, latent } = simpleAutoencoder(closes, windowSize, latentDim);
  if (latent.length < 2) return 0;
  
  let variance = 0;
  const mean = latent.reduce((a, b) => a + b, 0) / latent.length;
  for (const v of latent) {
    variance += Math.pow(v - mean, 2);
  }
  variance /= latent.length;
  
  return reconstructionError / (Math.sqrt(variance) + 0.01);
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

export class StratIter69BStrategy implements Strategy {
  params: StratIter69BParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private anomalyScores: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter69BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter69BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.anomalyScores.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const anomalyScores = this.anomalyScores.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    capPush(closes, bar.close);
    capPush(highs, bar.high);
    capPush(lows, bar.low);

    if (closes.length > this.params.window_size + 5) {
      const score = computeAnomalyScore(closes, this.params.window_size, this.params.latent_dim);
      capPush(anomalyScores, score);
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
    if (kVals.length < 3 || anomalyScores.length < 2) return;

    const currK = kVals[kVals.length - 1];
    const prevK = kVals[kVals.length - 2];
    const kRising = currK > prevK + 1;
    const oversold = currK <= this.params.stoch_oversold;

    const recentAnomaly = anomalyScores.slice(-3);
    const avgAnomaly = recentAnomaly.reduce((a, b) => a + b, 0) / recentAnomaly.length;
    const anomalySpike = avgAnomaly > this.params.anomaly_threshold;

    const { reconstructionError } = simpleAutoencoder(closes, this.params.window_size, this.params.latent_dim);
    const lowReconstruction = reconstructionError < this.params.reconstruction_error_threshold;

    const nearSupport = bar.close <= sr.support * 1.02;

    if (kRising && oversold && anomalySpike && lowReconstruction && nearSupport) {
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
