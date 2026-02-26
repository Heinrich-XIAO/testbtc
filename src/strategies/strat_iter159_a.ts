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

function momentum(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  return closes[closes.length - 1] - closes[closes.length - 1 - period];
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

export interface StratIter159AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  short_momentum_period: number;
  long_momentum_period: number;
  burst_threshold: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter159AStrategy implements Strategy {
  params: StratIter159AParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private momentumState: Map<string, { burstDetected: boolean; burstBar: number }> = new Map();

  constructor(params: Partial<StratIter159AParams> = {}) {
    const saved = loadSavedParams<StratIter159AParams>('strat_iter159_a.params.json');
    this.params = {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 16,
      short_momentum_period: 5,
      long_momentum_period: 20,
      burst_threshold: 0.012,
      support_buffer: 0.015,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter159AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
      this.kVals.set(bar.tokenId, []);
      this.momentumState.set(bar.tokenId, { burstDetected: false, burstBar: 0 });
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
    const { series, barNum } = this.nextBar(bar);

    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;

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

    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || series.closes.length < this.params.long_momentum_period + 2) return;

    const shortMom = momentum(series.closes, this.params.short_momentum_period);
    const longMom = momentum(series.closes, this.params.long_momentum_period);
    if (shortMom === null || longMom === null) return;

    const momentumDiff = shortMom - longMom;
    const state = this.momentumState.get(bar.tokenId)!;

    const burstJustEnded = state.burstDetected && momentumDiff < this.params.burst_threshold * 0.5;

    if (momentumDiff >= this.params.burst_threshold) {
      state.burstDetected = true;
      state.burstBar = barNum;
    } else if (momentumDiff < -this.params.burst_threshold * 0.3) {
      state.burstDetected = false;
    }

    const barsSinceBurst = burstJustEnded ? barNum - state.burstBar : 999;
    const pullbackValid = burstJustEnded && barsSinceBurst <= 3;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRecover = kv.length >= 2 && kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;

    if (pullbackValid && nearSupport && stochRecover) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
      state.burstDetected = false;
    }
  }
}

export const optimizationConfig = {
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  short_momentum_period: { min: 3, max: 7, stepSize: 1 },
  long_momentum_period: { min: 14, max: 24, stepSize: 2 },
  burst_threshold: { min: 0.008, max: 0.016, stepSize: 0.002 },
  support_buffer: { min: 0.010, max: 0.020, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, { min: number; max: number; stepSize: number }>;

export const outputFile = 'strat_iter159_a.params.json';
