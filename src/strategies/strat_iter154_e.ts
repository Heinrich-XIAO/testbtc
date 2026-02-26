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

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);
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

export interface StratIter154EParams extends StrategyParams {
  sr_lookback: number;
  flow_lookback: number;
  absorption_window: number;
  absorption_threshold: number;
  flow_momentum_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter154EStrategy extends BaseIterStrategy<StratIter154EParams> {
  private kVals: Map<string, number[]> = new Map();
  private flowHistory: Map<string, number[]> = new Map();
  private absorptionCount: Map<string, number> = new Map();
  constructor(params: Partial<StratIter154EParams> = {}) {
    super('strat_iter154_e.params.json', {
      sr_lookback: 50,
      flow_lookback: 8,
      absorption_window: 6,
      absorption_threshold: 3,
      flow_momentum_threshold: 0.008,
      stoch_k_period: 14,
      stoch_oversold: 18,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  private calculateFlowImbalance(series: TokenSeries, lookback: number): number {
    if (series.closes.length < lookback + 1 || series.highs.length < lookback + 1 || series.lows.length < lookback + 1) {
      return 0;
    }
    const closes = series.closes.slice(-lookback);
    const highs = series.highs.slice(-lookback);
    const lows = series.lows.slice(-lookback);
    
    let upVolume = 0;
    let downVolume = 0;
    
    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      const range = highs[i] - lows[i];
      if (range > 0) {
        if (change > 0) {
          upVolume += change / range;
        } else {
          downVolume += Math.abs(change) / range;
        }
      }
    }
    
    const total = upVolume + downVolume;
    if (total === 0) return 0;
    return (upVolume - downVolume) / total;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.flowHistory.has(bar.tokenId)) this.flowHistory.set(bar.tokenId, []);
    
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    
    const flow = this.calculateFlowImbalance(series, this.params.flow_lookback);
    capPush(this.flowHistory.get(bar.tokenId)!, flow);
    const fh = this.flowHistory.get(bar.tokenId)!;
    
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
        this.absorptionCount.delete(bar.tokenId);
      }
      return;
    }
    
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || fh.length < 2) return;
    
    const nearSupport = bar.low <= sr.support * 1.015;
    if (!nearSupport) {
      this.absorptionCount.delete(bar.tokenId);
      return;
    }
    
    const prevFlow = fh[fh.length - 2];
    const currFlow = fh[fh.length - 1];
    const flowReversing = prevFlow < -this.params.flow_momentum_threshold && currFlow > prevFlow;
    const flowMomentum = Math.abs(currFlow) >= this.params.flow_momentum_threshold;
    
    let absorptionScore = 0;
    if (fh.length >= this.params.absorption_window) {
      for (let i = Math.max(0, fh.length - this.params.absorption_window); i < fh.length; i++) {
        if (fh[i] < -0.1) absorptionScore += 1;
      }
    }
    
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    
    if (absorptionScore >= this.params.absorption_threshold && flowReversing && flowMomentum && stochRecover) {
      const opened = this.open(ctx, bar, barNum, this.params.risk_percent);
      if (opened) this.absorptionCount.delete(bar.tokenId);
    }
  }
}
