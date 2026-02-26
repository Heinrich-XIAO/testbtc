import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter153CParams extends StrategyParams {
  entropy_lookback: number;
  entropy_bins: number;
  entropy_threshold: number;
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter153CParams = {
  entropy_lookback: 30,
  entropy_bins: 8,
  entropy_threshold: 0.6,
  stoch_k_period: 14,
  stoch_d_period: 3,
  stoch_oversold: 16,
  stoch_overbought: 84,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 24,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter153CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter153_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function calculateEntropy(values: number[], numBins: number): number {
  if (values.length < 2) return 0;
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 0;
  
  const binWidth = (max - min) / numBins;
  const bins = new Array(numBins).fill(0);
  
  for (const v of values) {
    let binIndex = Math.floor((v - min) / binWidth);
    if (binIndex >= numBins) binIndex = numBins - 1;
    bins[binIndex]++;
  }
  
  let entropy = 0;
  const n = values.length;
  for (const count of bins) {
    if (count > 0) {
      const p = count / n;
      entropy -= p * Math.log2(p);
    }
  }
  
  return entropy;
}

function calculateJointEntropy(priceVals: number[], volumeVals: number[], numBins: number): number {
  if (priceVals.length < 2 || priceVals.length !== volumeVals.length) return 0;
  
  const pMin = Math.min(...priceVals);
  const pMax = Math.max(...priceVals);
  const vMin = Math.min(...volumeVals);
  const vMax = Math.max(...volumeVals);
  
  if (pMax === pMin || vMax === vMin) return 0;
  
  const jointBins = new Map<string, number>();
  
  for (let i = 0; i < priceVals.length; i++) {
    const pBin = Math.floor((priceVals[i] - pMin) / ((pMax - pMin) / numBins));
    const vBin = Math.floor((volumeVals[i] - vMin) / ((vMax - vMin) / numBins));
    const key = `${Math.min(pBin, numBins - 1)}-${Math.min(vBin, numBins - 1)}`;
    jointBins.set(key, (jointBins.get(key) || 0) + 1);
  }
  
  let entropy = 0;
  const n = priceVals.length;
  for (const count of jointBins.values()) {
    const p = count / n;
    entropy -= p * Math.log2(p);
  }
  
  return entropy;
}

export class StratIter153CStrategy implements Strategy {
  params: StratIter153CParams;
  private priceHistory: Map<string, number[]> = new Map();
  private volumeProxy: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private dValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter153CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter153CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateStochasticK(history: number[], highs: number[], lows: number[], period: number): number | null {
    if (history.length < period) return null;
    const slice = history.slice(-period);
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    const close = history[history.length - 1];
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  private calculateStochasticD(kValues: number[], period: number): number | null {
    if (kValues.length < period) return null;
    const slice = kValues.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.volumeProxy.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.dValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const volumeVals = this.volumeProxy.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const dVals = this.dValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    history.push(bar.close);
    if (history.length > 1) {
      const priceChange = Math.abs(bar.close - history[history.length - 2]);
      volumeVals.push(priceChange);
    }
    if (history.length > 200) history.shift();
    if (volumeVals.length > 200) volumeVals.shift();

    const highs = history.map((_, i) => bar.high);
    const lows = history.map((_, i) => bar.low);

    const k = this.calculateStochasticK(history, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 100) kVals.shift();

      const d = this.calculateStochasticD(kVals, this.params.stoch_d_period);
      if (d !== null) {
        dVals.push(d);
        if (dVals.length > 100) dVals.shift();
      }
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);

      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.close <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (bar.close >= entry * (1 + this.params.profit_target)) {
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
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      let jointEntropy = 0;
      if (history.length >= this.params.entropy_lookback && volumeVals.length >= this.params.entropy_lookback) {
        const priceSlice = history.slice(-this.params.entropy_lookback);
        const volumeSlice = volumeVals.slice(-this.params.entropy_lookback);
        jointEntropy = calculateJointEntropy(priceSlice, volumeSlice, this.params.entropy_bins);
      }

      if (kVals.length >= 2 && dVals.length >= 2 && jointEntropy > 0) {
        const prevK = kVals[kVals.length - 2];
        const prevD = dVals[dVals.length - 2];
        const currK = kVals[kVals.length - 1];
        const currD = dVals[dVals.length - 1];

        const crossedAboveOversold = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
        const kAboveD = currK > currD;
        const lowEntropy = jointEntropy < this.params.entropy_threshold;

        if (crossedAboveOversold && kAboveD && lowEntropy) {
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
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
