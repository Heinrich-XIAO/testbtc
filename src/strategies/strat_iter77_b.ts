import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
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

function computeAbsorptionRatio(
  closes: number[],
  highs: number[],
  lows: number[],
  opens: number[],
  window: number
): { ratio: number; valid: boolean } {
  if (closes.length < window + 1 || highs.length < window || lows.length < window || opens.length < window) {
    return { ratio: 0, valid: false };
  }

  let cumulativeFlow = 0;
  let totalAbsPriceChange = 0;

  for (let i = closes.length - window; i < closes.length; i++) {
    const range = highs[i] - lows[i];
    const midPrice = (highs[i] + lows[i]) / 2;
    const volumeProxy = range * midPrice;
    const priceChange = closes[i] - opens[i];
    const flow = volumeProxy * Math.sign(priceChange);
    cumulativeFlow += flow;
    totalAbsPriceChange += Math.abs(closes[i] - closes[i - 1]);
  }

  if (totalAbsPriceChange < 1e-8) {
    return { ratio: Infinity, valid: true };
  }

  const avgRange = highs.slice(-window).reduce((sum, h, i) => sum + (h - lows[i]), 0) / window;
  const avgMid = closes.slice(-window).reduce((a, b) => a + b, 0) / window;
  const avgVolumeProxy = avgRange * avgMid;
  
  if (avgVolumeProxy < 1e-8) {
    return { ratio: 0, valid: false };
  }

  const ratio = Math.abs(cumulativeFlow) / (totalAbsPriceChange * avgVolumeProxy);

  return { ratio, valid: true };
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], opens: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    capPush(s.opens, bar.open);
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

export interface StratIter77BParams extends StrategyParams {
  flow_window: number;
  absorption_threshold: number;
  support_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter77BStrategy extends BaseIterStrategy<StratIter77BParams> {
  constructor(params: Partial<StratIter77BParams> = {}) {
    super('strat_iter77_b.params.json', {
      flow_window: 10,
      absorption_threshold: 10,
      support_threshold: 0.02,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const { ratio, valid } = computeAbsorptionRatio(
      series.closes,
      series.highs,
      series.lows,
      series.opens,
      this.params.flow_window
    );

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

    if (shouldSkipPrice(bar.close) || !sr || !valid) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_threshold);
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const hasAbsorption = ratio >= this.params.absorption_threshold;

    if (nearSupport && stochOversold && hasAbsorption) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
