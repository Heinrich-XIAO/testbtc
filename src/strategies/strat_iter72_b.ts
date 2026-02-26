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

export interface StratIter72BParams extends StrategyParams {
  min_scale: number;
  max_scale: number;
  embedding_dim: number;
  tolerance: number;
  mse_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

function coarseGrain(series: number[], scale: number): number[] {
  if (scale === 1) return series.slice();
  const result: number[] = [];
  for (let j = 0; j < Math.floor(series.length / scale); j++) {
    let sum = 0;
    for (let i = 0; i < scale; i++) {
      sum += series[j * scale + i];
    }
    result.push(sum / scale);
  }
  return result;
}

function sampleEntropy(series: number[], m: number, r: number): number | null {
  const n = series.length;
  if (n < m + 2) return null;

  const std = Math.sqrt(series.reduce((sum, v) => sum + v * v, 0) / n - Math.pow(series.reduce((a, b) => a + b, 0) / n, 2));
  const tolerance = r * std;
  
  if (tolerance === 0) return null;

  let countM = 0;
  let countM1 = 0;

  for (let i = 0; i < n - m; i++) {
    for (let j = i + 1; j < n - m; j++) {
      let matchM = true;
      for (let k = 0; k < m; k++) {
        if (Math.abs(series[i + k] - series[j + k]) > tolerance) {
          matchM = false;
          break;
        }
      }
      if (matchM) {
        countM++;
        if (i + m < n && j + m < n) {
          if (Math.abs(series[i + m] - series[j + m]) <= tolerance) {
            countM1++;
          }
        }
      }
    }
  }

  if (countM === 0 || countM1 === 0) return null;
  return -Math.log(countM1 / countM);
}

function calculateMSE(series: number[], minScale: number, maxScale: number, m: number, r: number): number | null {
  const entropies: number[] = [];
  
  for (let scale = minScale; scale <= maxScale; scale++) {
    const coarse = coarseGrain(series, scale);
    const se = sampleEntropy(coarse, m, r);
    if (se !== null) {
      entropies.push(se);
    }
  }

  if (entropies.length === 0) return null;
  return entropies.reduce((a, b) => a + b, 0) / entropies.length;
}

export class StratIter72BStrategy extends BaseIterStrategy<StratIter72BParams> {
  private kVals: Map<string, number[]> = new Map();

  constructor(params: Partial<StratIter72BParams> = {}) {
    super('strat_iter72_b.params.json', {
      min_scale: 1,
      max_scale: 5,
      embedding_dim: 2,
      tolerance: 0.2,
      mse_threshold: 1.0,
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
    }
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const mse = calculateMSE(
      series.closes,
      this.params.min_scale,
      this.params.max_scale,
      this.params.embedding_dim,
      this.params.tolerance
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

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || mse === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const lowEntropy = mse < this.params.mse_threshold;

    if (nearSupport && stochRecover && lowEntropy) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
