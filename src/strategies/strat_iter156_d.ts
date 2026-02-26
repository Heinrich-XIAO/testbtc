import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

type QuarterState = {
  currentQuarterIndex: number;
  quarterOpen: number;
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

function getQuarter(timestamp: number): number {
  const month = new Date(toMsTimestamp(timestamp)).getUTCMonth();
  return Math.floor(month / 3) + 1;
}

function getQuarterIndex(timestamp: number): number {
  const date = new Date(toMsTimestamp(timestamp));
  const quarter = Math.floor(date.getUTCMonth() / 3);
  return date.getUTCFullYear() * 4 + quarter;
}

function quarterEnabled(mask: number, quarter: number): boolean {
  return ((mask >> (quarter - 1)) & 1) === 1;
}

function rollingQuarterScore(returns: number[], quarterLookback: number): number | null {
  if (returns.length === 0) return null;
  const window = returns.slice(-quarterLookback);
  if (window.length < Math.min(2, quarterLookback)) return null;
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

export interface StratIter156DParams extends StrategyParams {
  quarter_mask: number;
  min_quarter_score: number;
  quarter_lookback: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter156DStrategy extends BaseIterStrategy<StratIter156DParams> {
  private quarterState: Map<string, QuarterState> = new Map();
  private quarterlyReturns: Map<string, Map<number, number[]>> = new Map();

  constructor(params: Partial<StratIter156DParams> = {}) {
    super('strat_iter156_d.params.json', {
      quarter_mask: 15,
      min_quarter_score: 0.002,
      quarter_lookback: 8,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  private updateQuarterState(bar: Bar): void {
    if (!this.quarterlyReturns.has(bar.tokenId)) {
      this.quarterlyReturns.set(bar.tokenId, new Map<number, number[]>());
      for (let quarter = 1; quarter <= 4; quarter++) this.quarterlyReturns.get(bar.tokenId)!.set(quarter, []);
    }

    const quarterIndex = getQuarterIndex(bar.timestamp);
    const state = this.quarterState.get(bar.tokenId);
    if (!state) {
      this.quarterState.set(bar.tokenId, {
        currentQuarterIndex: quarterIndex,
        quarterOpen: bar.close,
        lastClose: bar.close,
      });
      return;
    }

    if (quarterIndex !== state.currentQuarterIndex) {
      const prevQuarter = (state.currentQuarterIndex % 4) + 1;
      const quarterReturn = (state.lastClose - state.quarterOpen) / Math.max(state.quarterOpen, 1e-9);
      capPush(this.quarterlyReturns.get(bar.tokenId)!.get(prevQuarter)!, quarterReturn, 80);
      state.currentQuarterIndex = quarterIndex;
      state.quarterOpen = bar.close;
    }

    state.lastClose = bar.close;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    this.updateQuarterState(bar);

    const quarter = getQuarter(bar.timestamp);
    const quarterReturns = this.quarterlyReturns.get(bar.tokenId)?.get(quarter) || [];
    const quarterScore = rollingQuarterScore(quarterReturns, this.params.quarter_lookback);
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

    if (shouldSkipPrice(bar.close) || !sr || quarterScore === null) return;
    if (!quarterEnabled(this.params.quarter_mask, quarter)) return;
    if (quarterScore < this.params.min_quarter_score) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    if (nearSupport && stochOversold) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
