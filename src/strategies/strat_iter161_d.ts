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

function cci(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const tp: number[] = [];
  for (let i = closes.length - period; i < closes.length; i++) {
    tp.push((highs[i] + lows[i] + closes[i]) / 3);
  }
  const tpSma = tp.reduce((a, b) => a + b, 0) / period;
  const meanDev = tp.reduce((sum, val) => sum + Math.abs(val - tpSma), 0) / period;
  if (meanDev === 0) return 0;
  return (tp[tp.length - 1] - tpSma) / (0.015 * meanDev);
}

function cciZScore(cciHistory: number[], period: number): number | null {
  if (cciHistory.length < period) return null;
  const recent = cciHistory.slice(-period);
  const mean = recent.reduce((a, b) => a + b, 0) / period;
  const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (cciHistory[cciHistory.length - 1] - mean) / std;
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

export interface StratIter161DParams extends StrategyParams {
  cci_period: number;
  zscore_period: number;
  zscore_threshold: number;
  sr_lookback: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter161DStrategy extends BaseIterStrategy<StratIter161DParams> {
  private cciHistory: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter161DParams> = {}) {
    super('strat_iter161_d.params.json', {
      cci_period: 14,
      zscore_period: 20,
      zscore_threshold: -1.5,
      sr_lookback: 50,
      support_buffer: 0.015,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.cciHistory.has(bar.tokenId)) this.cciHistory.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const cciVal = cci(series.highs, series.lows, series.closes, this.params.cci_period);
    
    if (cciVal !== null) {
      capPush(this.cciHistory.get(bar.tokenId)!, cciVal);
    }
    
    const cciHist = this.cciHistory.get(bar.tokenId)!;
    const zscore = cciZScore(cciHist, this.params.zscore_period);
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

    if (shouldSkipPrice(bar.close) || !sr || zscore === null) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const zscoreOversold = zscore < this.params.zscore_threshold;

    if (nearSupport && zscoreOversold) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
