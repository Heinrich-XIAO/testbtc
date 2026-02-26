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

function momentum(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  const current = closes[closes.length - 1];
  const prior = closes[closes.length - period - 1];
  if (prior === 0) return null;
  return (current - prior) / prior;
}

function momentumVariance(closes: number[], period: number, lookback: number): number | null {
  if (closes.length < period + lookback + 1) return null;
  const mom: number[] = [];
  for (let i = 0; i < lookback; i++) {
    const current = closes[closes.length - 1 - i];
    const prior = closes[closes.length - period - 1 - i];
    if (prior === 0) return null;
    mom.push((current - prior) / prior);
  }
  const mean = mom.reduce((a, b) => a + b, 0) / mom.length;
  const variance = mom.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / mom.length;
  return variance;
}

function calcStochastic(highs: number[], lows: number[], closes: number[], kPeriod: number, dPeriod: number): { k: number; d: number } | null {
  if (highs.length < kPeriod + 1 || lows.length < kPeriod + 1 || closes.length < kPeriod + 1) return null;
  const recentHighs = highs.slice(-kPeriod);
  const recentLows = lows.slice(-kPeriod);
  const recentCloses = closes.slice(-kPeriod);
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  if (highestHigh === lowestLow) return null;
  const k = ((recentCloses[recentCloses.length - 1] - lowestLow) / (highestHigh - lowestLow)) * 100;
  const d = k;
  return { k, d };
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
  protected partialTaken: Map<string, boolean> = new Map();

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
      this.partialTaken.set(bar.tokenId, false);
      return true;
    }
    return false;
  }

  protected close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.partialTaken.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter159DParams extends StrategyParams {
  partial_profit: number;
  partial_percent: number;
  stop_loss: number;
  profit_target: number;
  momentum_lookback: number;
  momentum_period: number;
  regime_variance_threshold: number;
  stoch_oversold: number;
  stoch_k_period: number;
  momentum_rise_threshold: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter159DStrategy extends BaseIterStrategy<StratIter159DParams> {
  constructor(params: Partial<StratIter159DParams> = {}) {
    super('strat_iter159_d.params.json', {
      partial_profit: 0.10,
      partial_percent: 0.5,
      stop_loss: 0.08,
      profit_target: 0.18,
      momentum_lookback: 20,
      momentum_period: 8,
      regime_variance_threshold: 0.0001,
      stoch_oversold: 16,
      stoch_k_period: 14,
      momentum_rise_threshold: 0.004,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      const partial = this.partialTaken.get(bar.tokenId) || false;

      if (!partial && bar.high >= e * (1 + this.params.partial_profit)) {
        const partialSize = pos.size * this.params.partial_percent;
        ctx.sell(bar.tokenId, partialSize);
        this.partialTaken.set(bar.tokenId, true);
      }

      const adjustedStop = partial ? e : e * (1 - this.params.stop_loss);

      if (bar.low <= adjustedStop ||
          bar.high >= e * (1 + this.params.profit_target) ||
          (sr && bar.high >= sr.resistance * 0.98) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    if (!nearSupport) return;

    const currentMomentum = momentum(series.closes, this.params.momentum_period);
    if (currentMomentum === null) return;

    const priorMomentum = momentum(series.closes.slice(0, -1), this.params.momentum_period);
    if (priorMomentum === null) return;

    const variance = momentumVariance([...series.closes], this.params.momentum_period, this.params.momentum_lookback);
    if (variance === null) return;

    const isRanging = variance < this.params.regime_variance_threshold;
    if (!isRanging) return;

    const momentumRising = currentMomentum > priorMomentum + this.params.momentum_rise_threshold;
    if (!momentumRising) return;

    const stoch = calcStochastic(series.highs, series.lows, series.closes, this.params.stoch_k_period, 3);
    if (!stoch) return;

    const stochOversold = stoch.k < this.params.stoch_oversold;

    if (stochOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
