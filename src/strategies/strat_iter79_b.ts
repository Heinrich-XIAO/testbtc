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

function computeADFStatistic(closes: number[], windowSize: number, numLags: number): number | null {
  if (closes.length < windowSize + numLags + 5) return null;

  const y: number[] = closes.slice(-windowSize);
  const n = y.length;
  
  if (n < numLags + 3) return null;

  const dy: number[] = [];
  for (let i = 1; i < n; i++) {
    dy.push(y[i] - y[i - 1]);
  }

  const laggedDy: number[][] = [];
  for (let lag = 1; lag <= numLags; lag++) {
    const col: number[] = [];
    for (let i = 0; i < dy.length; i++) {
      col.push(i >= lag ? dy[i - lag] : 0);
    }
    laggedDy.push(col);
  }

  const yLagged = y.slice(0, -1);

  const obsCount = dy.length - numLags;
  if (obsCount < 10) return null;

  const yLagObs = yLagged.slice(-obsCount);
  const dyObs = dy.slice(-obsCount);
  const laggedObs: number[][] = laggedDy.map(col => col.slice(-obsCount));

  let sumY = 0, sumDy = 0;
  for (let i = 0; i < obsCount; i++) {
    sumY += yLagObs[i];
    sumDy += dyObs[i];
  }
  const meanY = sumY / obsCount;
  const meanDy = sumDy / obsCount;

  let sumYY = 0, sumYDy = 0, sumDyDy = 0;
  for (let i = 0; i < obsCount; i++) {
    const yc = yLagObs[i] - meanY;
    const dyc = dyObs[i] - meanDy;
    sumYY += yc * yc;
    sumYDy += yc * dyc;
    sumDyDy += dyc * dyc;
  }

  if (sumYY === 0) return null;

  const gamma = sumYDy / sumYY;

  const residuals: number[] = [];
  for (let i = 0; i < obsCount; i++) {
    residuals.push(dyObs[i] - meanDy - gamma * (yLagObs[i] - meanY));
  }

  let ssr = 0;
  for (const r of residuals) {
    ssr += r * r;
  }

  const se = Math.sqrt(ssr / (obsCount - 2)) / Math.sqrt(sumYY);

  if (se === 0) return null;

  const tStat = gamma / se;

  return tStat;
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

export interface StratIter79BParams extends StrategyParams {
  window_size: number;
  num_lags: number;
  adf_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter79BStrategy extends BaseIterStrategy<StratIter79BParams> {
  constructor(params: Partial<StratIter79BParams> = {}) {
    super('strat_iter79_b.params.json', {
      window_size: 40,
      num_lags: 2,
      adf_threshold: -2.5,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const adfStat = computeADFStatistic(
      series.closes,
      this.params.window_size,
      this.params.num_lags
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

    if (shouldSkipPrice(bar.close) || !sr || adfStat === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const stationaryPrice = adfStat < this.params.adf_threshold;

    if (nearSupport && stochOversold && stationaryPrice) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
