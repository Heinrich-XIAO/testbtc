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

function vwma_proxy(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const momentum: number[] = [];
  for (let i = 1; i < window.length; i++) {
    momentum.push(Math.abs(window[i] - window[i - 1]));
  }
  const totalMomentum = momentum.reduce((a, b) => a + b, 0);
  if (totalMomentum === 0) return window[window.length - 1];
  const weights: number[] = [];
  let cumWeight = 0;
  for (let i = 0; i < momentum.length; i++) {
    cumWeight += momentum[i] / totalMomentum;
    weights.push(cumWeight);
  }
  weights.unshift(0);
  let weightedSum = 0;
  let totalWeight = 0;
  for (let i = 0; i < window.length; i++) {
    const w = weights[i] + (i < momentum.length ? momentum[i] / totalMomentum : 1) / 2;
    weightedSum += window[i] * w;
    totalWeight += w;
  }
  return weightedSum / totalWeight;
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

export interface StratIter111CParams extends StrategyParams {
  period: number;
  threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter111CStrategy extends BaseIterStrategy<StratIter111CParams> {
  constructor(params: Partial<StratIter111CParams> = {}) {
    super('strat_iter111_c.params.json', {
      period: 20,
      threshold: 0.01,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const vwma = vwma_proxy(series.closes, this.params.period);
    const prevVwma = series.closes.length > this.params.period ? vwma_proxy(series.closes.slice(0, -1), this.params.period) : null;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

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

    if (shouldSkipPrice(bar.close) || !sr || vwma === null || prevVwma === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const priceAboveVwma = bar.close > vwma;
    const vwmaRising = vwma > prevVwma && (vwma - prevVwma) / prevVwma >= this.params.threshold;

    if (nearSupport && priceAboveVwma && vwmaRising) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
