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

function diffusionMapEmbedding(closes: number[], embedDim: number, timeLag: number): number[] {
  if (closes.length < embedDim * timeLag + 2) return [];
  const n = Math.min(closes.length, embedDim * timeLag + 1);
  const points: number[][] = [];
  for (let i = 0; i < n; i++) {
    const point: number[] = [];
    for (let j = 0; j < embedDim; j++) {
      const idx = i + j * timeLag;
      if (idx < closes.length) point.push(closes[idx]);
    }
    if (point.length === embedDim) points.push(point);
  }
  if (points.length < 3) return [];
  const dists: number[][] = [];
  for (let i = 0; i < points.length; i++) {
    dists[i] = [];
    for (let j = 0; j < points.length; j++) {
      let d = 0;
      for (let k = 0; k < points[i].length; k++) {
        d += (points[i][k] - points[j][k]) ** 2;
      }
      dists[i][j] = Math.sqrt(d);
    }
  }
  const flatDists = dists.flat().filter((_, i) => i % (dists.length + 1) !== 0);
  const sigma = mean(flatDists) * 0.5;
  if (sigma <= 0) return [];
  const kernel: number[][] = [];
  for (let i = 0; i < dists.length; i++) {
    kernel[i] = [];
    for (let j = 0; j < dists.length; j++) {
      kernel[i][j] = Math.exp(-(dists[i][j] ** 2) / (2 * sigma ** 2));
    }
  }
  let total = 0;
  for (let i = 0; i < kernel.length; i++) total += kernel[i][i];
  if (total <= 0) return [];
  const eigenvec: number[] = [];
  for (let i = 0; i < kernel.length; i++) {
    let sum = 0;
    for (let j = 0; j < kernel.length; j++) sum += kernel[i][j];
    eigenvec.push(sum / total);
  }
  eigenvec.sort((a, b) => b - a);
  return eigenvec.slice(0, Math.min(3, eigenvec.length));
}

export interface StratIter67AParams extends StrategyParams {
  embed_dim: number;
  time_lag: number;
  eigen_threshold: number;
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter67AStrategy implements Strategy {
  params: StratIter67APrivateParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private eigenHist: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter67APrivateParams> = {}) {
    const saved = loadSavedParams<StratIter67APrivateParams>('strat_iter67_a.params.json');
    this.params = { ...getDefaults(), ...saved, ...params } as StratIter67APrivateParams;
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
    if (!this.eigenHist.has(bar.tokenId)) this.eigenHist.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const eigen = diffusionMapEmbedding(series.closes, this.params.embed_dim, this.params.time_lag);
    capPush(this.eigenHist.get(bar.tokenId)!, eigen.length > 0 ? eigen[0] : 0);
    const eh = this.eigenHist.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || eh.length < 3) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const manifoldCond = eh[eh.length - 1] > this.params.eigen_threshold && eh[eh.length - 2] < eh[eh.length - 1];
    if (nearSupport && stochRecover && manifoldCond) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

function getDefaults(): StratIter67APrivateParams {
  return {
    embed_dim: 4,
    time_lag: 3,
    eigen_threshold: 0.15,
    sr_lookback: 50,
    stoch_k_period: 14,
    stoch_oversold: 18,
    stop_loss: 0.08,
    profit_target: 0.18,
    max_hold_bars: 28,
    risk_percent: 0.25,
  };
}

interface StratIter67APrivateParams extends StrategyParams {
  embed_dim: number;
  time_lag: number;
  eigen_threshold: number;
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}
