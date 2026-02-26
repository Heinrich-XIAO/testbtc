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

function adxr(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (closes.length < period * 2 + 1) return null;
  
  const calcDM = (): { plusDM: number[]; minusDM: number[]; tr: number[] } => {
    const plusDM: number[] = [0];
    const minusDM: number[] = [0];
    const tr: number[] = [highs[0] - lows[0]];
    
    for (let i = 1; i < highs.length; i++) {
      const upMove = highs[i] - highs[i - 1];
      const downMove = lows[i - 1] - lows[i];
      
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
      
      const trVal = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      tr.push(trVal);
    }
    return { plusDM, minusDM, tr };
  };
  
  const { plusDM, minusDM, tr } = calcDM();
  
  const wilderSmooth = (values: number[], p: number): number[] => {
    const smoothed: number[] = [];
    let sum = values.slice(0, p).reduce((a, b) => a + b, 0);
    smoothed.push(sum);
    for (let i = p; i < values.length; i++) {
      sum = sum - sum / p + values[i];
      smoothed.push(sum);
    }
    return smoothed;
  };
  
  const smoothedPlusDM = wilderSmooth(plusDM, period);
  const smoothedMinusDM = wilderSmooth(minusDM, period);
  const smoothedTR = wilderSmooth(tr, period);
  
  const dx: number[] = [];
  for (let i = 0; i < smoothedPlusDM.length; i++) {
    if (smoothedTR[i] === 0) {
      dx.push(0);
    } else {
      dx.push(100 * Math.abs(smoothedPlusDM[i] - smoothedMinusDM[i]) / smoothedTR[i]);
    }
  }
  
  const adxValues = wilderSmooth(dx, period);
  
  const adxrValues: number[] = [];
  for (let i = period; i < adxValues.length; i++) {
    adxrValues.push((adxValues[i] + adxValues[i - period]) / 2);
  }
  
  return adxrValues.length > 0 ? adxrValues[adxrValues.length - 1] : null;
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

export interface StratIter132AParams extends StrategyParams {
  adxr_low: number;
  adxr_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter132AStrategy extends BaseIterStrategy<StratIter132AParams> {
  constructor(params: Partial<StratIter132AParams> = {}) {
    super('strat_iter132_a.params.json', {
      adxr_low: 20,
      adxr_period: 14,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const adxrVal = adxr(series.highs, series.lows, series.closes, this.params.adxr_period);
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

    if (shouldSkipPrice(bar.close) || !sr || adxrVal === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const adxrLow = adxrVal < this.params.adxr_low;

    if (nearSupport && adxrLow) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}