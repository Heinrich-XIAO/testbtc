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

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function shannonEntropy(returns: number[], numBins: number): number {
  if (returns.length < 2) return 0;
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  if (max === min) return 0;
  const binSize = (max - min) / numBins;
  if (binSize === 0) return 0;
  const counts = new Array(numBins).fill(0);
  for (const r of returns) {
    let bin = Math.floor((r - min) / binSize);
    bin = Math.min(bin, numBins - 1);
    bin = Math.max(bin, 0);
    counts[bin]++;
  }
  let entropy = 0;
  const n = returns.length;
  for (const c of counts) {
    if (c > 0) {
      const p = c / n;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

export interface StratIter51BParams extends StrategyParams {
  sr_lookback: number;
  entropy_lookback: number;
  entropy_bins: number;
  entropy_entry_threshold: number;
  entropy_exit_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter51BStrategy implements Strategy {
  params: StratIter51BParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private entropyAtEntry: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter51BParams> = {}) {
    const saved = loadSavedParams<StratIter51BParams>('strat_iter51_b.params.json');
    const defaults: StratIter51BParams = {
      sr_lookback: 50,
      entropy_lookback: 24,
      entropy_bins: 6,
      entropy_entry_threshold: 1.8,
      entropy_exit_threshold: 2.4,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    };
    this.params = { ...defaults, ...saved, ...params } as StratIter51BParams;
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
    this.entropyAtEntry.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const returns: number[] = [];
    for (let i = Math.max(1, series.closes.length - this.params.entropy_lookback); i < series.closes.length; i++) {
      const prev = series.closes[i - 1];
      const curr = series.closes[i];
      if (prev > 0) returns.push((curr - prev) / prev);
    }
    const entropy = shannonEntropy(returns, this.params.entropy_bins);

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId)!;
      const ebar = this.entryBar.get(bar.tokenId)!;
      const stoppedOut = bar.low <= entry * (1 - this.params.stop_loss);
      const hitTarget = bar.high >= entry * (1 + this.params.profit_target);
      const hitResistance = sr && bar.high >= sr.resistance * 0.98;
      const maxHeld = barNum - ebar >= this.params.max_hold_bars;
      const chaosReturned = entropy >= this.params.entropy_exit_threshold;
      if (stoppedOut || hitTarget || hitResistance || maxHeld || chaosReturned) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || returns.length < this.params.entropy_lookback / 2) return;

    const lowEntropy = entropy < this.params.entropy_entry_threshold;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = kv[kv.length - 1] <= this.params.stoch_oversold;

    if (lowEntropy && nearSupport && stochOversold) {
      const opened = this.open(ctx, bar, barNum, this.params.risk_percent);
      if (opened) this.entropyAtEntry.set(bar.tokenId, entropy);
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
