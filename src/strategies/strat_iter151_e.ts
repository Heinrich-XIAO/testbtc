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

function hpFilter(closes: number[], lambda: number): number | null {
  if (closes.length < 6) return null;
  const n = Math.min(closes.length, 50);
  const slice = closes.slice(-n);
  const y = slice;
  const a: number[] = new Array(n).fill(0);
  const b: number[] = new Array(n).fill(0);
  const c: number[] = new Array(n).fill(0);
  const r: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    a[i] = lambda;
    b[i] = -2 * lambda;
    c[i] = lambda;
    r[i] = y[i];
  }
  a[0] = 0;
  b[0] = 1 + lambda;
  c[0] = -lambda;
  a[n - 1] = -lambda;
  b[n - 1] = 1 + lambda;
  c[n - 1] = 0;
  for (let i = 1; i < n; i++) {
    const w = a[i] / b[i - 1];
    b[i] = b[i] - w * c[i - 1];
    r[i] = r[i] - w * r[i - 1];
  }
  const trend: number[] = new Array(n).fill(0);
  trend[n - 1] = r[n - 1] / b[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    trend[i] = (r[i] - c[i] * trend[i + 1]) / b[i];
  }
  const lastTrend = trend[n - 1];
  if (lastTrend === null || isNaN(lastTrend) || !isFinite(lastTrend)) return null;
  const lastClose = slice[n - 1];
  return (lastClose - lastTrend) / lastTrend;
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

export interface StratIter151EParams extends StrategyParams {
  sr_lookback: number;
  hp_lambda: number;
  cycle_oversold: number;
  cycle_reclaim: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter151EStrategy extends BaseIterStrategy<StratIter151EParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter151EParams> = {}) {
    super('strat_iter151_e.params.json', {
      sr_lookback: 50,
      hp_lambda: 1600,
      cycle_oversold: -0.02,
      cycle_reclaim: -0.005,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId)!;
      const ebar = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= entry * (1 - this.params.stop_loss) || bar.high >= entry * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - ebar >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || series.closes.length < 20) return;
    const cycle = hpFilter(series.closes, this.params.hp_lambda);
    if (cycle === null) return;

    const deeplyOversold = cycle <= this.params.cycle_oversold;
    const reclaimed = cycle >= this.params.cycle_reclaim;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (deeplyOversold && reclaimed && nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
