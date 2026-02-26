import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  memory: number[];
  memoryWeights: number[];
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

function memoryNetworkSignal(closes: number[], series: TokenSeries, memorySize: number, lookback: number): { signal: number; memoryHit: number } | null {
  if (closes.length < lookback + 1) return null;
  
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  
  const currentPattern: number[] = [];
  for (let i = 0; i < lookback; i++) {
    const idx = returns.length - 1 - i;
    currentPattern.push(idx >= 0 ? returns[idx] : 0);
  }
  
  if (series.memory.length === 0) {
    for (let i = 0; i < memorySize; i++) {
      series.memory.push(0);
      series.memoryWeights.push(1 / memorySize);
    }
  }
  
  const similarities: number[] = [];
  for (let i = 0; i < series.memory.length; i++) {
    const memVal = series.memory[i];
    let similarity = 0;
    for (let j = 0; j < Math.min(3, currentPattern.length); j++) {
      similarity += Math.exp(-Math.abs(currentPattern[j] - memVal) * 100);
    }
    similarities.push(similarity / 3);
  }
  
  const simSum = similarities.reduce((a, b) => a + b, 0);
  const normalizedSims = similarities.map(s => s / (simSum + 0.001));
  
  let weightedMemory = 0;
  for (let i = 0; i < series.memory.length; i++) {
    weightedMemory += series.memory[i] * normalizedSims[i] * series.memoryWeights[i];
  }
  
  const lastReturn = returns[returns.length - 1];
  
  let oldestIdx = 0;
  let oldestWeight = series.memoryWeights[0];
  for (let i = 1; i < series.memory.length; i++) {
    if (series.memoryWeights[i] < oldestWeight) {
      oldestWeight = series.memoryWeights[i];
      oldestIdx = i;
    }
  }
  series.memory[oldestIdx] = lastReturn;
  series.memoryWeights[oldestIdx] = 0.5;
  
  for (let i = 0; i < series.memoryWeights.length; i++) {
    series.memoryWeights[i] *= 0.99;
  }
  
  const currentSignal = currentPattern.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const signal = currentSignal + weightedMemory * 0.5;
  
  return { signal, memoryHit: weightedMemory };
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], memory: [], memoryWeights: [] });
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

export interface StratIter100EParams extends StrategyParams {
  memory_size: number;
  lookback: number;
  signal_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter100EStrategy extends BaseIterStrategy<StratIter100EParams> {
  constructor(params: Partial<StratIter100EParams> = {}) {
    super('strat_iter100_e.params.json', {
      memory_size: 10,
      lookback: 5,
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
    const memResult = memoryNetworkSignal(series.closes, series, this.params.memory_size, this.params.lookback);

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

    if (shouldSkipPrice(bar.close) || !sr || !memResult) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const memBuy = memResult.signal > this.params.signal_threshold;

    if (nearSupport && stochOversold && memBuy) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}