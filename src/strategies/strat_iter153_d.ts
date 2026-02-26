import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter153DParams extends StrategyParams {
  pattern_window: number;
  history_segments: number;
  cross_entropy_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter153DParams = {
  pattern_window: 20,
  history_segments: 5,
  cross_entropy_threshold: 0.35,
  stoch_k_period: 14,
  stoch_oversold: 16,
  stoch_overbought: 84,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 24,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter153DParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter153_d.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function calculateProbabilityDistribution(values: number[], numBins: number): number[] {
  if (values.length < 2) return new Array(numBins).fill(1 / numBins);

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (max - min < 1e-9) return new Array(numBins).fill(1 / numBins);

  const bins = new Array(numBins).fill(0);

  for (const v of values) {
    let binIndex = Math.floor(((v - min) / (max - min)) * numBins);
    if (binIndex >= numBins) binIndex = numBins - 1;
    bins[binIndex]++;
  }

  return bins.map(count => count / values.length);
}

function crossEntropy(p: number[], q: number[]): number {
  const numBins = Math.min(p.length, q.length);
  let ce = 0;

  for (let i = 0; i < numBins; i++) {
    const pi = p[i] > 0 ? p[i] : 1e-10;
    const qi = q[i] > 0 ? q[i] : 1e-10;
    ce -= pi * Math.log2(qi);
  }

  return ce;
}

function calculatePatternSimilarity(currentReturns: number[], historicalReturns: number[], numBins: number): number {
  if (currentReturns.length < 2 || historicalReturns.length < 2) return 1;

  const pDist = calculateProbabilityDistribution(currentReturns, numBins);
  const qDist = calculateProbabilityDistribution(historicalReturns, numBins);

  return crossEntropy(pDist, qDist);
}

export class StratIter153DStrategy implements Strategy {
  params: StratIter153DParams;
  private priceHistory: Map<string, number[]> = new Map();
  private returnsHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter153DParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter153DParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateStochasticK(history: number[], highs: number[], lows: number[], period: number): number | null {
    if (history.length < period || highs.length < period || lows.length < period) return null;
    const slice = history.slice(-period);
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    const close = history[history.length - 1];
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.returnsHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const priceHistory = this.priceHistory.get(bar.tokenId)!;
    const returnsHistory = this.returnsHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    priceHistory.push(bar.close);
    if (priceHistory.length > 1) {
      const prev = priceHistory[priceHistory.length - 2];
      if (prev > 0) {
        const ret = (bar.close - prev) / prev;
        returnsHistory.push(ret);
      }
    }

    if (priceHistory.length > 500) priceHistory.shift();
    if (returnsHistory.length > 500) returnsHistory.shift();

    const highs = priceHistory.map(() => bar.high);
    const lows = priceHistory.map(() => bar.low);

    const k = this.calculateStochasticK(priceHistory, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 100) kVals.shift();
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
      const pw = this.params.pattern_window;
      const hs = this.params.history_segments;

      if (returnsHistory.length >= pw + pw * hs) {
        const currentPattern = returnsHistory.slice(-pw);

        let minCrossEntropy = Infinity;
        let validSegment = false;

        const segmentSize = pw;
        for (let i = 0; i < hs; i++) {
          const startIdx = returnsHistory.length - pw - (i + 1) * segmentSize;
          if (startIdx < 0) break;

          const historicalSegment = returnsHistory.slice(startIdx, startIdx + pw);
          if (historicalSegment.length < pw) continue;

          const crossEnt = calculatePatternSimilarity(currentPattern, historicalSegment, 8);
          if (crossEnt < minCrossEntropy) {
            minCrossEntropy = crossEnt;
          }
          validSegment = true;
        }

        if (validSegment && minCrossEntropy < this.params.cross_entropy_threshold) {
          if (kVals.length >= 2) {
            const prevK = kVals[kVals.length - 2];
            const currK = kVals[kVals.length - 1];

            const crossedAboveOversold = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;

            if (crossedAboveOversold) {
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
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
