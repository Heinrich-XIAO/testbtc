import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

type MonthState = {
  currentMonthIndex: number;
  monthOpen: number;
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

function getMonth(timestamp: number): number {
  return new Date(toMsTimestamp(timestamp)).getUTCMonth() + 1;
}

function getMonthIndex(timestamp: number): number {
  const date = new Date(toMsTimestamp(timestamp));
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function monthEnabled(monthMask: number, month: number): boolean {
  return ((monthMask >> (month - 1)) & 1) === 1;
}

function rollingMonthScore(returns: number[], monthLookback: number): number | null {
  if (returns.length === 0) return null;
  const window = returns.slice(-monthLookback);
  if (window.length < Math.min(3, monthLookback)) return null;
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

export interface StratIter156CParams extends StrategyParams {
  month_mask: number;
  min_month_score: number;
  month_lookback: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter156CStrategy extends BaseIterStrategy<StratIter156CParams> {
  private monthState: Map<string, MonthState> = new Map();
  private monthlyReturns: Map<string, Map<number, number[]>> = new Map();

  constructor(params: Partial<StratIter156CParams> = {}) {
    super('strat_iter156_c.params.json', {
      month_mask: 4095,
      min_month_score: 0.003,
      month_lookback: 8,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  private updateMonthState(bar: Bar): void {
    if (!this.monthlyReturns.has(bar.tokenId)) {
      this.monthlyReturns.set(bar.tokenId, new Map<number, number[]>());
      for (let month = 1; month <= 12; month++) this.monthlyReturns.get(bar.tokenId)!.set(month, []);
    }

    const monthIndex = getMonthIndex(bar.timestamp);
    const state = this.monthState.get(bar.tokenId);
    if (!state) {
      this.monthState.set(bar.tokenId, {
        currentMonthIndex: monthIndex,
        monthOpen: bar.close,
        lastClose: bar.close,
      });
      return;
    }

    if (monthIndex !== state.currentMonthIndex) {
      const prevMonth = (state.currentMonthIndex % 12) + 1;
      const monthlyReturn = (state.lastClose - state.monthOpen) / Math.max(state.monthOpen, 1e-9);
      capPush(this.monthlyReturns.get(bar.tokenId)!.get(prevMonth)!, monthlyReturn, 120);
      state.currentMonthIndex = monthIndex;
      state.monthOpen = bar.close;
    }

    state.lastClose = bar.close;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    this.updateMonthState(bar);

    const month = getMonth(bar.timestamp);
    const monthReturns = this.monthlyReturns.get(bar.tokenId)?.get(month) || [];
    const monthScore = rollingMonthScore(monthReturns, this.params.month_lookback);
    const k = stochK(series.closes, series.highs, series.lows, 14);
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

    if (shouldSkipPrice(bar.close) || !sr || monthScore === null) return;
    if (!monthEnabled(this.params.month_mask, month)) return;
    if (monthScore < this.params.min_month_score) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    if (nearSupport && stochOversold) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
