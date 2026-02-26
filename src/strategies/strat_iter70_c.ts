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

function calculateShannonEntropy(changes: number[], binCount: number): number {
  if (changes.length < 2) return 0;

  const min = Math.min(...changes);
  const max = Math.max(...changes);
  const range = max - min;
  
  if (range === 0) return 0;

  const binSize = range / binCount;
  const bins: number[] = new Array(binCount).fill(0);

  for (const change of changes) {
    let binIndex = Math.floor((change - min) / binSize);
    binIndex = Math.min(binIndex, binCount - 1);
    binIndex = Math.max(binIndex, 0);
    bins[binIndex]++;
  }

  let entropy = 0;
  const total = changes.length;
  
  for (const count of bins) {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log(p);
    }
  }

  return entropy;
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

export interface StratIter70CParams extends StrategyParams {
  entropy_window: number;
  entropy_threshold: number;
  bin_count: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter70CStrategy extends BaseIterStrategy<StratIter70CParams> {
  private kVals: Map<string, number[]> = new Map();
  private entropyHistory: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter70CParams> = {}) {
    super('strat_iter70_c.params.json', {
      entropy_window: 20,
      entropy_threshold: 1.5,
      bin_count: 7,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  private calculatePriceChanges(closes: number[]): number[] {
    if (closes.length < 2) return [];
    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      const change = (closes[i] - closes[i - 1]) / Math.max(closes[i - 1], 1e-9);
      changes.push(change);
    }
    return changes;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) {
      this.kVals.set(bar.tokenId, []);
      this.entropyHistory.set(bar.tokenId, []);
    }
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    if (series.closes.length >= this.params.entropy_window) {
      const windowCloses = series.closes.slice(-this.params.entropy_window);
      const changes = this.calculatePriceChanges(windowCloses);
      if (changes.length > 0) {
        const entropy = calculateShannonEntropy(changes, this.params.bin_count);
        capPush(this.entropyHistory.get(bar.tokenId)!, entropy);
      }
    }

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

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || series.closes.length < this.params.entropy_window) return;

    const entropyHist = this.entropyHistory.get(bar.tokenId)!;
    if (entropyHist.length < 1) return;

    const currentEntropy = entropyHist[entropyHist.length - 1];
    const lowEntropy = currentEntropy < this.params.entropy_threshold;
    
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = kv[kv.length - 1] < this.params.stoch_oversold;

    if (nearSupport && stochOversold && lowEntropy) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
