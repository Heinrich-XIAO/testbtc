import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

type HalfYearState = {
  currentHalfYearIndex: number;
  halfYearOpen: number;
  lastClose: number;
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

function toMsTimestamp(timestamp: number): number {
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

function getHalfYear(timestamp: number): number {
  const month = new Date(toMsTimestamp(timestamp)).getUTCMonth() + 1;
  return month <= 6 ? 1 : 2;
}

function getHalfYearIndex(timestamp: number): number {
  const date = new Date(toMsTimestamp(timestamp));
  const half = date.getUTCMonth() < 6 ? 0 : 1;
  return date.getUTCFullYear() * 2 + half;
}

function halfYearEnabled(mask: number, halfYear: number): boolean {
  return ((mask >> (halfYear - 1)) & 1) === 1;
}

function rollingHalfYearScore(returns: number[], halfYearLookback: number): number | null {
  if (returns.length === 0) return null;
  const window = returns.slice(-halfYearLookback);
  if (window.length < Math.min(2, halfYearLookback)) return null;
  const sum = window.reduce((acc, value) => acc + value, 0);
  return sum / window.length;
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

export interface StratIter156EParams extends StrategyParams {
  halfyear_mask: number;
  min_halfyear_score: number;
  halfyear_lookback: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter156EStrategy extends BaseIterStrategy<StratIter156EParams> {
  private halfYearState: Map<string, HalfYearState> = new Map();
  private halfYearReturns: Map<string, Map<number, number[]>> = new Map();

  constructor(params: Partial<StratIter156EParams> = {}) {
    super('strat_iter156_e.params.json', {
      halfyear_mask: 3,
      min_halfyear_score: 0.001,
      halfyear_lookback: 8,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  private updateHalfYearState(bar: Bar): void {
    if (!this.halfYearReturns.has(bar.tokenId)) {
      this.halfYearReturns.set(bar.tokenId, new Map<number, number[]>());
      for (let halfYear = 1; halfYear <= 2; halfYear++) this.halfYearReturns.get(bar.tokenId)!.set(halfYear, []);
    }

    const halfYearIndex = getHalfYearIndex(bar.timestamp);
    const state = this.halfYearState.get(bar.tokenId);
    if (!state) {
      this.halfYearState.set(bar.tokenId, {
        currentHalfYearIndex: halfYearIndex,
        halfYearOpen: bar.close,
        lastClose: bar.close,
      });
      return;
    }

    if (halfYearIndex !== state.currentHalfYearIndex) {
      const prevHalfYear = (state.currentHalfYearIndex % 2) + 1;
      const halfYearReturn = (state.lastClose - state.halfYearOpen) / Math.max(state.halfYearOpen, 1e-9);
      capPush(this.halfYearReturns.get(bar.tokenId)!.get(prevHalfYear)!, halfYearReturn, 40);
      state.currentHalfYearIndex = halfYearIndex;
      state.halfYearOpen = bar.close;
    }

    state.lastClose = bar.close;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    this.updateHalfYearState(bar);

    const halfYear = getHalfYear(bar.timestamp);
    const returns = this.halfYearReturns.get(bar.tokenId)?.get(halfYear) || [];
    const halfYearScore = rollingHalfYearScore(returns, this.params.halfyear_lookback);
    const k = stochK(series.closes, series.highs, series.lows, 14);
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

    if (shouldSkipPrice(bar.close) || !sr || halfYearScore === null) return;
    if (!halfYearEnabled(this.params.halfyear_mask, halfYear)) return;
    if (halfYearScore < this.params.min_halfyear_score) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    if (nearSupport && stochOversold) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
