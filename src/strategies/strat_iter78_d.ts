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

function computeReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  return returns;
}

function fitAR(returns: number[], order: number): number[] {
  if (returns.length < order + 10) return [];
  
  const phi: number[] = new Array(order).fill(0);
  
  for (let p = 0; p < order; p++) {
    let sumXY = 0;
    let sumX2 = 0;
    const lag = p + 1;
    
    for (let i = lag; i < returns.length; i++) {
      const x = returns[i - lag];
      const y = returns[i];
      sumXY += x * y;
      sumX2 += x * x;
    }
    
    if (sumX2 > 0) {
      phi[p] = sumXY / sumX2;
    }
  }
  
  return phi;
}

function computeResiduals(returns: number[], phi: number[]): number[] {
  const order = phi.length;
  if (returns.length < order + 10) return [];
  
  const residuals: number[] = [];
  
  for (let i = order; i < returns.length; i++) {
    let predicted = 0;
    for (let p = 0; p < order; p++) {
      predicted += phi[p] * returns[i - (p + 1)];
    }
    residuals.push(returns[i] - predicted);
  }
  
  return residuals;
}

function residualAutocorrelation(residuals: number[], maxLag: number = 5): number {
  if (residuals.length < maxLag + 10) return 1;
  
  const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
  const variance = residuals.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / residuals.length;
  
  if (variance === 0) return 1;
  
  let sumACF = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let acf = 0;
    for (let i = lag; i < residuals.length; i++) {
      acf += (residuals[i] - mean) * (residuals[i - lag] - mean);
    }
    acf /= (residuals.length * variance);
    sumACF += acf * acf;
  }
  
  return Math.sqrt(sumACF / maxLag);
}

function analyzeARIMAResiduals(
  closes: number[],
  windowSize: number,
  arOrder: number
): { residualAcf: number; phi: number[] } | null {
  if (closes.length < windowSize + arOrder + 10) return null;
  
  const recentCloses = closes.slice(-windowSize);
  const returns = computeReturns(recentCloses);
  
  if (returns.length < arOrder + 10) return null;
  
  const phi = fitAR(returns, arOrder);
  const residuals = computeResiduals(returns, phi);
  
  if (residuals.length < 10) return null;
  
  const residualAcf = residualAutocorrelation(residuals);
  
  return { residualAcf, phi };
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

export interface StratIter78DParams extends StrategyParams {
  window_size: number;
  ar_order: number;
  residual_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter78DStrategy extends BaseIterStrategy<StratIter78DParams> {
  constructor(params: Partial<StratIter78DParams> = {}) {
    super('strat_iter78_d.params.json', {
      window_size: 40,
      ar_order: 1,
      residual_threshold: 0.2,
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

    const arimaResult = analyzeARIMAResiduals(
      series.closes,
      this.params.window_size,
      this.params.ar_order
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

    if (shouldSkipPrice(bar.close) || !sr || !arimaResult) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const lowResidualAcf = arimaResult.residualAcf < this.params.residual_threshold;

    if (nearSupport && stochOversold && lowResidualAcf) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
