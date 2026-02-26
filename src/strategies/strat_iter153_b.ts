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

function discretizeReturns(returns: number[], numBins: number): number[] {
  if (returns.length === 0) return [];
  const minR = Math.min(...returns);
  const maxR = Math.max(...returns);
  const range = maxR - minR || 1;
  return returns.map(r => Math.floor((r - minR) / range * (numBins - 1)));
}

function calculateEntropy(values: number[]): number {
  if (values.length === 0) return 0;
  const freq: Map<number, number> = new Map();
  for (const v of values) freq.set(v, (freq.get(v) || 0) + 1);
  let entropy = 0;
  const n = values.length;
  for (const count of freq.values()) {
    const p = count / n;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

function calculateConditionalEntropy(pastReturns: number[], futureReturns: number[], numBins: number): number {
  if (pastReturns.length < 2 || futureReturns.length < 1) return 0;
  const pastBins = discretizeReturns(pastReturns, numBins);
  const futureBins = discretizeReturns(futureReturns, numBins);
  if (pastBins.length === 0 || futureBins.length === 0) return 0;
  const joint: Map<string, number> = new Map();
  const pastMarginal: Map<number, number> = new Map();
  for (let i = 0; i < pastBins.length - 1; i++) {
    const key = `${pastBins[i]},${futureBins[i]}`;
    joint.set(key, (joint.get(key) || 0) + 1);
    pastMarginal.set(pastBins[i], (pastMarginal.get(pastBins[i]) || 0) + 1);
  }
  const n = pastBins.length;
  let condEntropy = 0;
  for (const [key, jointCount] of joint) {
    const [pb] = key.split(',').map(Number);
    const pJoint = jointCount / n;
    const pPast = (pastMarginal.get(pb) || 0) / n;
    if (pPast > 0) condEntropy -= pPast * Math.log2(pJoint / pPast);
  }
  return condEntropy;
}

export interface StratIter153BParams extends StrategyParams {
  sr_lookback: number;
  past_lookback: number;
  future_lookback: number;
  num_bins: number;
  entropy_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter153BStrategy implements Strategy {
  params: StratIter153BParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private entropyHist: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter153BParams> = {}) {
    const saved = loadSavedParams<StratIter153BParams>('strat_iter153_b.params.json');
    this.params = {
      sr_lookback: 50,
      past_lookback: 24,
      future_lookback: 4,
      num_bins: 8,
      entropy_threshold: 0.35,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter153BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
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

  private open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
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

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.entropyHist.has(bar.tokenId)) this.entropyHist.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;

    if (series.closes.length > this.params.past_lookback + this.params.future_lookback + 2) {
      const pastWindow = series.closes.slice(-(this.params.past_lookback + this.params.future_lookback + 1), -this.params.future_lookback - 1);
      const futureWindow = series.closes.slice(-this.params.future_lookback - 1, -1);
      const pastReturns: number[] = [];
      for (let i = 1; i < pastWindow.length; i++) {
        if (pastWindow[i - 1] > 0) pastReturns.push((pastWindow[i] - pastWindow[i - 1]) / pastWindow[i - 1]);
      }
      const futureReturns: number[] = [];
      for (let i = 1; i < futureWindow.length; i++) {
        if (futureWindow[i - 1] > 0) futureReturns.push((futureWindow[i] - futureWindow[i - 1]) / futureWindow[i - 1]);
      }
      if (pastReturns.length > 3 && futureReturns.length > 1) {
        const condEnt = calculateConditionalEntropy(pastReturns, futureReturns, this.params.num_bins);
        capPush(this.entropyHist.get(bar.tokenId)!, condEnt);
      }
    }

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2) return;
    const eh = this.entropyHist.get(bar.tokenId)!;
    const lowEntropy = eh.length > 0 && eh[eh.length - 1] <= this.params.entropy_threshold;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (lowEntropy && nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
