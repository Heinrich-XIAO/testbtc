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

function emaNext(prev: number | undefined, value: number, period: number): number {
  const alpha = 2 / (period + 1);
  if (prev === undefined) return value;
  return prev + alpha * (value - prev);
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

export interface StratIter162EParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  macd_fast: number;
  macd_slow: number;
  macd_signal: number;
  support_buffer: number;
  momentum_lookback: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter162EStrategy implements Strategy {
  params: StratIter162EParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private macdHist: Map<string, number[]> = new Map();
  private macdVal: Map<string, number[]> = new Map();
  private macdFast: Map<string, number> = new Map();
  private macdSlow: Map<string, number> = new Map();
  private macdSignal: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter162EParams> = {}) {
    const saved = loadSavedParams<StratIter162EParams>('strat_iter162_e.params.json');
    this.params = {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 16,
      macd_fast: 12,
      macd_slow: 26,
      macd_signal: 9,
      support_buffer: 0.015,
      momentum_lookback: 3,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter162EParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
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

  private computeMACDMomentumPositive(tokenId: string): boolean {
    const hist = this.macdHist.get(tokenId);
    const macdVals = this.macdVal.get(tokenId);
    if (!hist || !macdVals || hist.length < this.params.momentum_lookback + 2) return false;

    const w = this.params.momentum_lookback;
    const prevHist = hist[hist.length - 2];
    const currHist = hist[hist.length - 1];
    const macdBelowZero = macdVals[macdVals.length - 1] < 0;

    const momentumTurnsPositive = prevHist < 0 && currHist >= 0;

    return momentumTurnsPositive && macdBelowZero;
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
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

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) {
      this.kVals.set(bar.tokenId, []);
      this.macdHist.set(bar.tokenId, []);
      this.macdVal.set(bar.tokenId, []);
    }

    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;

    if (series.closes.length >= this.params.macd_slow + 1) {
      const fastPrev = this.macdFast.get(bar.tokenId);
      const slowPrev = this.macdSlow.get(bar.tokenId);
      const signalPrev = this.macdSignal.get(bar.tokenId);

      const fast = emaNext(fastPrev, series.closes[series.closes.length - 1], this.params.macd_fast);
      const slow = emaNext(slowPrev, series.closes[series.closes.length - 1], this.params.macd_slow);
      const macd = fast - slow;
      const signal = emaNext(signalPrev, macd, this.params.macd_signal);
      const hist = macd - signal;

      this.macdFast.set(bar.tokenId, fast);
      this.macdSlow.set(bar.tokenId, slow);
      this.macdSignal.set(bar.tokenId, signal);
      capPush(this.macdHist.get(bar.tokenId)!, hist);
      capPush(this.macdVal.get(bar.tokenId)!, macd);
    }

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

    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2) return;

    const macdMomentumPositive = this.computeMACDMomentumPositive(bar.tokenId);
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;

    if (macdMomentumPositive && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
