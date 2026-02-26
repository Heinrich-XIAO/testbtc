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

function computeVolatility(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) return null;
  let trSum = 0;
  for (let i = highs.length - period; i < highs.length; i++) {
    const prevClose = closes[i - 1];
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - prevClose), Math.abs(lows[i] - prevClose));
    trSum += tr;
  }
  return trSum / period;
}

function percentileRank(values: number[], current: number): number {
  if (values.length < 2) return 50;
  let below = 0;
  for (const v of values) {
    if (v < current) below += 1;
  }
  return (below / values.length) * 100;
}

export interface StratIter158AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  vol_period: number;
  vol_rank_period: number;
  high_vol_threshold: number;
  normal_vol_max: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter158AStrategy implements Strategy {
  params: StratIter158AParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private volHistory: Map<string, number[]> = new Map();
  private volRegime: Map<string, 'low' | 'normal' | 'high'> = new Map();
  private prevVolRegime: Map<string, 'low' | 'normal' | 'high'> = new Map();

  constructor(params: Partial<StratIter158AParams> = {}) {
    const saved = loadSavedParams<StratIter158AParams>('strat_iter158_a.params.json');
    this.params = {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      vol_period: 14,
      vol_rank_period: 30,
      high_vol_threshold: 75,
      normal_vol_max: 50,
      support_buffer: 0.015,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter158AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
      this.kVals.set(bar.tokenId, []);
      this.volHistory.set(bar.tokenId, []);
      this.volRegime.set(bar.tokenId, 'normal');
      this.prevVolRegime.set(bar.tokenId, 'normal');
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
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

  onComplete(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.volHistory.has(bar.tokenId)) this.volHistory.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);

    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;

    const vol = computeVolatility(series.highs, series.lows, series.closes, this.params.vol_period);
    if (vol !== null) {
      capPush(this.volHistory.get(bar.tokenId)!, vol);
      const vh = this.volHistory.get(bar.tokenId)!;
      if (vh.length >= this.params.vol_rank_period) {
        const volWindow = vh.slice(-this.params.vol_rank_period);
        const rank = percentileRank(volWindow, vol);
        const prevRegime = this.volRegime.get(bar.tokenId) || 'normal';
        let newRegime: 'low' | 'normal' | 'high' = 'normal';
        if (rank >= this.params.high_vol_threshold) {
          newRegime = 'high';
        } else if (rank <= this.params.normal_vol_max) {
          newRegime = 'low';
        }
        this.prevVolRegime.set(bar.tokenId, prevRegime);
        this.volRegime.set(bar.tokenId, newRegime);
      }
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

    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || series.highs.length < this.params.vol_period + 2) return;

    const prevRegime = this.prevVolRegime.get(bar.tokenId) || 'normal';
    const currentRegime = this.volRegime.get(bar.tokenId) || 'normal';
    const regimeShift = prevRegime === 'high' && currentRegime === 'normal';

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRecover = kv.length >= 2 && kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;

    if (regimeShift && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export const optimizationConfig = {
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  vol_period: { min: 10, max: 20, stepSize: 2 },
  vol_rank_period: { min: 20, max: 40, stepSize: 5 },
  high_vol_threshold: { min: 70, max: 85, stepSize: 5 },
  normal_vol_max: { min: 40, max: 55, stepSize: 5 },
  support_buffer: { min: 0.010, max: 0.020, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, { min: number; max: number; stepSize: number }>;

export const outputFile = 'strat_iter158_a.params.json';
