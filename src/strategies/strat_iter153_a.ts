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

function calculateShannonEntropy(returns: number[], numBins: number): number | null {
  if (returns.length < 2) return null;
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  if (max - min < 1e-9) return 0;
  const bins = new Array(numBins).fill(0);
  for (const r of returns) {
    const idx = Math.min(numBins - 1, Math.floor(((r - min) / (max - min)) * numBins));
    bins[idx]++;
  }
  let entropy = 0;
  const n = returns.length;
  for (const count of bins) {
    if (count > 0) {
      const p = count / n;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

function maxEntropy(numBins: number): number {
  return Math.log2(numBins);
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

export interface StratIter153AParams extends StrategyParams {
  sr_lookback: number;
  entropy_window: number;
  entropy_bins: number;
  max_entropy_ratio: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter153AStrategy extends BaseIterStrategy<StratIter153AParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter153AParams> = {}) {
    super(
      'strat_iter153_a.params.json',
      {
        sr_lookback: 50,
        entropy_window: 20,
        entropy_bins: 8,
        max_entropy_ratio: 0.65,
        stoch_k_period: 14,
        stoch_oversold: 18,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const ew = this.params.entropy_window;
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || series.closes.length < ew + 2) return;

    const returns: number[] = [];
    for (let i = 1; i <= ew; i++) {
      const curr = series.closes[series.closes.length - i];
      const prev = series.closes[series.closes.length - 1 - i];
      if (prev > 0) returns.push((curr - prev) / prev);
    }

    const entropy = calculateShannonEntropy(returns, this.params.entropy_bins);
    if (entropy === null) return;

    const maxEnt = maxEntropy(this.params.entropy_bins);
    const entropyRatio = entropy / maxEnt;
    const lowEntropy = entropyRatio <= this.params.max_entropy_ratio;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;

    if (lowEntropy && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
