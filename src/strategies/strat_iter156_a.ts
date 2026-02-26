import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

type PendingBounce = {
  weekday: number;
  close: number;
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

function weekdayFromTimestamp(timestamp: number): number {
  return new Date(timestamp).getUTCDay();
}

function isWeekdayEnabled(mask: number, weekday: number): boolean {
  return (mask & (1 << weekday)) !== 0;
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

export interface StratIter156AParams extends StrategyParams {
  weekday_mask: number;
  min_day_bias: number;
  day_lookback: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter156AStrategy extends BaseIterStrategy<StratIter156AParams> {
  private kVals: Map<string, number[]> = new Map();
  private dayBounceByWeekday: Map<string, Map<number, number[]>> = new Map();
  private pendingBounce: Map<string, PendingBounce> = new Map();

  constructor(params: Partial<StratIter156AParams> = {}) {
    super('strat_iter156_a.params.json', {
      weekday_mask: 127,
      min_day_bias: 0.52,
      day_lookback: 40,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  private getDayBuckets(tokenId: string): Map<number, number[]> {
    if (!this.dayBounceByWeekday.has(tokenId)) this.dayBounceByWeekday.set(tokenId, new Map());
    return this.dayBounceByWeekday.get(tokenId)!;
  }

  private recordPendingBounce(tokenId: string, currentClose: number): void {
    const pending = this.pendingBounce.get(tokenId);
    if (!pending) return;
    const buckets = this.getDayBuckets(tokenId);
    if (!buckets.has(pending.weekday)) buckets.set(pending.weekday, []);
    const outcome = currentClose > pending.close ? 1 : 0;
    capPush(buckets.get(pending.weekday)!, outcome, this.params.day_lookback);
    this.pendingBounce.delete(tokenId);
  }

  private updatePendingForCurrentBar(tokenId: string, bar: Bar, nearSupport: boolean): void {
    if (!nearSupport) return;
    this.pendingBounce.set(tokenId, {
      weekday: weekdayFromTimestamp(bar.timestamp),
      close: bar.close,
    });
  }

  private dayBiasScore(tokenId: string, weekday: number): number {
    const buckets = this.getDayBuckets(tokenId);
    const samples = buckets.get(weekday) || [];
    if (samples.length < 3) return 0.5;
    const wins = samples.reduce((sum, v) => sum + v, 0);
    return wins / samples.length;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);

    const k = stochK(series.closes, series.highs, series.lows, 14);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);

    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const nearSupport = !!sr && bar.low <= sr.support * 1.015;
    const weekday = weekdayFromTimestamp(bar.timestamp);

    this.recordPendingBounce(bar.tokenId, bar.close);
    this.updatePendingForCurrentBar(bar.tokenId, bar, nearSupport);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2) return;
    if (!isWeekdayEnabled(this.params.weekday_mask, weekday)) return;

    const dayBias = this.dayBiasScore(bar.tokenId, weekday);
    if (dayBias < this.params.min_day_bias) return;

    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
