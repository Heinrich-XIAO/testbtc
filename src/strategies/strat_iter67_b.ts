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

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((s, x) => s + (x - m) * (x - m), 0) / values.length;
  return Math.sqrt(v);
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

function loopAnomalyScore(closes: number[], lookback: number, normFactor: number): number {
  if (closes.length < lookback + 1) return 0.5;
  const window = closes.slice(-lookback);
  const mu = mean(window);
  const sigma = stddev(window) * normFactor;
  if (sigma <= 0) return 0.5;
  const z = (closes[closes.length - 1] - mu) / sigma;
  const prob = 1 / (1 + Math.exp(-Math.abs(z)));
  return prob;
}

export interface StratIter67BParams extends StrategyParams {
  loop_lookback: number;
  loop_normfactor: number;
  loop_threshold_low: number;
  loop_threshold_high: number;
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter67BStrategy implements Strategy {
  params: StratIter67BPrivateParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private loopHist: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter67BPrivateParams> = {}) {
    const saved = loadSavedParams<StratIter67BPrivateParams>('strat_iter67_b.params.json');
    this.params = { ...getDefaults(), ...saved, ...params } as StratIter67BPrivateParams;
  }

  onInit(_ctx: BacktestContext): void {}
  onComplete(_ctx: BacktestContext): void {}

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
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.loopHist.has(bar.tokenId)) this.loopHist.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const loop = loopAnomalyScore(series.closes, this.params.loop_lookback, this.params.loop_normfactor);
    capPush(this.loopHist.get(bar.tokenId)!, loop);
    const lh = this.loopHist.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || lh.length < 2) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const anomalyCond = lh[lh.length - 1] > this.params.loop_threshold_low && lh[lh.length - 1] < this.params.loop_threshold_high && (lh[lh.length - 2] < lh[lh.length - 1]);
    if (nearSupport && stochRecover && anomalyCond) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

function getDefaults(): StratIter67BPrivateParams {
  return {
    loop_lookback: 24,
    loop_normfactor: 1.5,
    loop_threshold_low: 0.35,
    loop_threshold_high: 0.65,
    sr_lookback: 50,
    stoch_k_period: 14,
    stoch_oversold: 18,
    stop_loss: 0.08,
    profit_target: 0.18,
    max_hold_bars: 28,
    risk_percent: 0.25,
  };
}

interface StratIter67BPrivateParams extends StrategyParams {
  loop_lookback: number;
  loop_normfactor: number;
  loop_threshold_low: number;
  loop_threshold_high: number;
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}
