import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  fastMomentum: number[];
  slowMomentum: number[];
  leadLagProxy: number[];
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
  const high = Math.max(...highs.slice(-period));
  const low = Math.min(...lows.slice(-period));
  if (high === low) return 50;
  return ((closes[closes.length - 1] - low) / (high - low)) * 100;
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
      this.series.set(bar.tokenId, {
        closes: [],
        highs: [],
        lows: [],
        fastMomentum: [],
        slowMomentum: [],
        leadLagProxy: [],
      });
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

export interface StratIter157CParams extends StrategyParams {
  fast_window: number;
  slow_window: number;
  slow_oversold_threshold: number;
  fast_rebound_delta: number;
  min_proxy_expansion: number;
  stoch_oversold: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter157CStrategy extends BaseIterStrategy<StratIter157CParams> {
  constructor(params: Partial<StratIter157CParams> = {}) {
    super('strat_iter157_c.params.json', {
      fast_window: 2,
      slow_window: 10,
      slow_oversold_threshold: -0.02,
      fast_rebound_delta: 0.004,
      min_proxy_expansion: 0.003,
      stoch_oversold: 18,
      support_buffer: 0.015,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId)!;
      const entryBar = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= entry * (1 - this.params.stop_loss) ||
        bar.high >= entry * (1 + this.params.profit_target) ||
        barNum - entryBar >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr || shouldSkipPrice(bar.close)) return;

    const fastWindow = Math.max(1, Math.floor(this.params.fast_window));
    const slowWindow = Math.max(fastWindow + 1, Math.floor(this.params.slow_window));

    if (series.closes.length > fastWindow) {
      const fastMom = bar.close / series.closes[series.closes.length - 1 - fastWindow] - 1;
      capPush(series.fastMomentum, fastMom);
    }

    if (series.closes.length > slowWindow) {
      const slowMom = bar.close / series.closes[series.closes.length - 1 - slowWindow] - 1;
      capPush(series.slowMomentum, slowMom);
      if (series.fastMomentum.length > 0) {
        const proxy = series.fastMomentum[series.fastMomentum.length - 1] - slowMom;
        capPush(series.leadLagProxy, proxy);
      }
    }

    const k = stochK(series.closes, series.highs, series.lows, 14);
    if (k === null || series.fastMomentum.length < 2 || series.slowMomentum.length < 2 || series.leadLagProxy.length < 2) return;

    const fastNow = series.fastMomentum[series.fastMomentum.length - 1];
    const fastPrev = series.fastMomentum[series.fastMomentum.length - 2];
    const slowNow = series.slowMomentum[series.slowMomentum.length - 1];
    const slowPrev = series.slowMomentum[series.slowMomentum.length - 2];
    const proxyNow = series.leadLagProxy[series.leadLagProxy.length - 1];
    const proxyPrev = series.leadLagProxy[series.leadLagProxy.length - 2];

    const fastImproving = fastNow - fastPrev >= this.params.fast_rebound_delta;
    const slowStillOversold =
      slowNow <= this.params.slow_oversold_threshold &&
      slowPrev <= this.params.slow_oversold_threshold;
    const proxyExpanding = proxyNow - proxyPrev >= this.params.min_proxy_expansion;
    const stochOversold = k < this.params.stoch_oversold;
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);

    if (fastImproving && slowStillOversold && proxyExpanding && stochOversold && nearSupport) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
