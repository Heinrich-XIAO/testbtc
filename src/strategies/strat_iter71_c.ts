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

function calculateApEn(data: number[], m: number, r: number): number | null {
  const N = data.length;
  if (N < m + 1) return null;

  const stdDev = Math.sqrt(data.reduce((sum, val) => sum + val * val, 0) / N - Math.pow(data.reduce((s, v) => s + v, 0) / N, 2));
  const threshold = r * stdDev;

  if (threshold === 0) return null;

  function phi(m: number): number {
    const patterns: number[][] = [];
    for (let i = 0; i <= N - m; i++) {
      patterns.push(data.slice(i, i + m));
    }

    let sum = 0;
    for (let i = 0; i < patterns.length; i++) {
      let count = 0;
      for (let j = 0; j < patterns.length; j++) {
        let similar = true;
        for (let k = 0; k < m; k++) {
          if (Math.abs(patterns[i][k] - patterns[j][k]) > threshold) {
            similar = false;
            break;
          }
        }
        if (similar) count++;
      }
      const ci = count / patterns.length;
      if (ci > 0) sum += Math.log(ci);
    }
    return sum / patterns.length;
  }

  const phim = phi(m);
  const phim1 = phi(m + 1);

  return phim - phim1;
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

export interface StratIter71CParams extends StrategyParams {
  embedding_dim: number;
  tolerance: number;
  window_size: number;
  apen_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter71CStrategy extends BaseIterStrategy<StratIter71CParams> {
  private kVals: Map<string, number[]> = new Map();
  private apenHistory: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter71CParams> = {}) {
    super('strat_iter71_c.params.json', {
      embedding_dim: 2,
      tolerance: 0.2,
      window_size: 40,
      apen_threshold: 1.0,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) {
      this.kVals.set(bar.tokenId, []);
      this.apenHistory.set(bar.tokenId, []);
    }
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    if (series.closes.length >= this.params.window_size) {
      const windowCloses = series.closes.slice(-this.params.window_size);
      const apen = calculateApEn(windowCloses, this.params.embedding_dim, this.params.tolerance);
      if (apen !== null) {
        capPush(this.apenHistory.get(bar.tokenId)!, apen);
      }
    }

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

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || series.closes.length < this.params.window_size) return;

    const apenHist = this.apenHistory.get(bar.tokenId)!;
    if (apenHist.length < 1) return;

    const currentApEn = apenHist[apenHist.length - 1];
    const lowApEn = currentApEn < this.params.apen_threshold;
    
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = kv[kv.length - 1] < this.params.stoch_oversold;

    if (nearSupport && stochOversold && lowApEn) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
