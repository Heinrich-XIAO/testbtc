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

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    emaVal = (values[i] - emaVal) * multiplier + emaVal;
  }
  return emaVal;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function macd(closes: number[], fastPeriod: number, slowPeriod: number, signalPeriod: number): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < slowPeriod + signalPeriod) return null;
  const fastEma: number[] = [];
  const slowEma: number[] = [];
  const multiplier = 2 / (fastPeriod + 1);
  const slowMultiplier = 2 / (slowPeriod + 1);
  
  let fastVal = closes.slice(0, fastPeriod).reduce((a, b) => a + b, 0) / fastPeriod;
  let slowVal = closes.slice(0, slowPeriod).reduce((a, b) => a + b, 0) / slowPeriod;
  
  for (let i = 0; i < closes.length; i++) {
    if (i >= fastPeriod) fastVal = (closes[i] - fastVal) * multiplier + fastVal;
    if (i >= slowPeriod) slowVal = (closes[i] - slowVal) * slowMultiplier + slowVal;
    if (i >= slowPeriod) {
      fastEma.push(fastVal);
      slowEma.push(slowVal);
    }
  }
  
  const macdLine: number[] = [];
  for (let i = 0; i < fastEma.length; i++) {
    macdLine.push(fastEma[i] - slowEma[i]);
  }
  
  if (macdLine.length < signalPeriod) return null;
  let signalEma = macdLine.slice(0, signalPeriod).reduce((a, b) => a + b, 0) / signalPeriod;
  const signalMultiplier = 2 / (signalPeriod + 1);
  for (let i = signalPeriod; i < macdLine.length; i++) {
    signalEma = (macdLine[i] - signalEma) * signalMultiplier + signalEma;
  }
  
  const macdVal = macdLine[macdLine.length - 1];
  return { macd: macdVal, signal: signalEma, histogram: macdVal - signalEma };
}

function dmi(highs: number[], lows: number[], closes: number[], period: number): { plusDI: number; minusDI: number; adx: number } | null {
  if (closes.length < period * 2) return null;
  
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  const tr: number[] = [];
  
  for (let i = 1; i < highs.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }
  
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
  
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];
  
  for (let i = 0; i < smoothedPlusDM.length; i++) {
    const pdi = smoothedTR[i] > 0 ? (smoothedPlusDM[i] / smoothedTR[i]) * 100 : 0;
    const mdi = smoothedTR[i] > 0 ? (smoothedMinusDM[i] / smoothedTR[i]) * 100 : 0;
    plusDI.push(pdi);
    minusDI.push(mdi);
    
    if (pdi + mdi > 0) {
      dx.push(100 * Math.abs(pdi - mdi) / (pdi + mdi));
    } else {
      dx.push(0);
    }
  }
  
  const adxValues = wilderSmooth(dx, period);
  
  return {
    plusDI: plusDI[plusDI.length - 1],
    minusDI: minusDI[minusDI.length - 1],
    adx: adxValues[adxValues.length - 1]
  };
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

export interface StratIter141BParams extends StrategyParams {
  ma_period: number;
  macd_fast: number;
  macd_slow: number;
  macd_signal: number;
  dmi_period: number;
  adx_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter141BStrategy extends BaseIterStrategy<StratIter141BParams> {
  constructor(params: Partial<StratIter141BParams> = {}) {
    super('strat_iter141_b.params.json', {
      ma_period: 20,
      macd_fast: 12,
      macd_slow: 26,
      macd_signal: 9,
      dmi_period: 14,
      adx_threshold: 25,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const ma = sma(series.closes, this.params.ma_period);
    const macdVal = macd(series.closes, this.params.macd_fast, this.params.macd_slow, this.params.macd_signal);
    const dmiVal = dmi(series.highs, series.lows, series.closes, this.params.dmi_period);
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

    if (shouldSkipPrice(bar.close) || !sr || !ma || !macdVal || !dmiVal) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const aboveMA = bar.close > ma;
    const macdBullish = macdVal.histogram > 0;
    const strongTrend = dmiVal.adx > this.params.adx_threshold;
    const plusDominant = dmiVal.plusDI > dmiVal.minusDI;

    if (nearSupport && aboveMA && macdBullish && strongTrend && plusDominant) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
