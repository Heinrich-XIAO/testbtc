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

function atr(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = highs.length - period; i < highs.length; i++) {
    const prevClose = closes[i - 1];
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - prevClose), Math.abs(lows[i] - prevClose));
    trs.push(tr);
  }
  return trs.reduce((s, v) => s + v, 0) / period;
}

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 50;
  let below = 0;
  for (const v of values) if (v <= value) below += 1;
  return (below / values.length) * 100;
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

function calcVolatility(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  const rets: number[] = [];
  for (let i = Math.max(1, closes.length - period); i < closes.length; i++) {
    const prev = closes[i - 1];
    if (prev > 0) rets.push(Math.abs((closes[i] - prev) / prev));
  }
  if (rets.length === 0) return null;
  const sum = rets.reduce((s, v) => s + v, 0);
  return sum / rets.length;
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

export interface StratIter158BParams extends StrategyParams {
  sr_lookback: number;
  vol_period: number;
  vol_percentile_lookback: number;
  compression_threshold: number;
  breakout_min_move: number;
  stoch_k_period: number;
  stoch_oversold: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter158BStrategy extends BaseIterStrategy<StratIter158BParams> {
  private kVals: Map<string, number[]> = new Map();
  private volatilityHistory: Map<string, number[]> = new Map();
  private compressionStart: Map<string, number> = new Map();
  constructor(params: Partial<StratIter158BParams> = {}) {
    super('strat_iter158_b.params.json', {
      sr_lookback: 50,
      vol_period: 14,
      vol_percentile_lookback: 40,
      compression_threshold: 15,
      breakout_min_move: 0.008,
      stoch_k_period: 14,
      stoch_oversold: 16,
      support_buffer: 0.015,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.volatilityHistory.has(bar.tokenId)) this.volatilityHistory.set(bar.tokenId, []);
    
    const { series, barNum } = this.nextBar(bar);
    
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    
    const vol = calcVolatility(series.closes, this.params.vol_period);
    if (vol !== null) capPush(this.volatilityHistory.get(bar.tokenId)!, vol);
    const volHist = this.volatilityHistory.get(bar.tokenId)!;
    
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || volHist.length < this.params.vol_percentile_lookback) return;

    const currentVol = volHist[volHist.length - 1];
    const volWindow = volHist.slice(-this.params.vol_percentile_lookback);
    const volPercentile = percentileRank(volWindow, currentVol);
    
    const inCompression = volPercentile <= this.params.compression_threshold;
    const wasInCompression = this.compressionStart.has(bar.tokenId);
    
    if (inCompression && !wasInCompression) {
      this.compressionStart.set(bar.tokenId, barNum);
    }
    
    if (!inCompression && wasInCompression) {
      this.compressionStart.delete(bar.tokenId);
    }
    
    const compressionBar = this.compressionStart.get(bar.tokenId);
    const breakoutValid = compressionBar !== undefined && barNum - compressionBar >= 2;
    
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    
    const prevClose = series.closes[series.closes.length - 2];
    const breakoutMove = prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;
    const breakoutConfirmed = breakoutMove >= this.params.breakout_min_move;

    if (inCompression && breakoutValid && nearSupport && stochRecover && breakoutConfirmed) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
