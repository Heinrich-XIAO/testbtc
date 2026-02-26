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

function gaussian(x: number, mean: number, std: number): number {
  const exponent = -((x - mean) ** 2) / (2 * std ** 2);
  return Math.exp(exponent) / (std * Math.sqrt(2 * Math.PI));
}

function naiveBayesScore(closes: number[], windowSize: number, upThreshold: number, downThreshold: number): number | null {
  if (closes.length < windowSize + 1) return null;
  
  const window = closes.slice(-windowSize - 1);
  const returns: number[] = [];
  
  for (let i = 1; i < window.length; i++) {
    returns.push((window[i] - window[i - 1]) / window[i - 1]);
  }
  
  const upReturns = returns.filter(r => r > upThreshold);
  const downReturns = returns.filter(r => r < -downThreshold);
  const flatReturns = returns.filter(r => r >= -downThreshold && r <= upThreshold);
  
  const pUp = upReturns.length / returns.length;
  const pDown = downReturns.length / returns.length;
  const pFlat = flatReturns.length / returns.length;
  
  const currentReturn = returns[returns.length - 1];
  
  const allReturns = returns.slice(0, -1);
  const mean = allReturns.reduce((a, b) => a + b, 0) / allReturns.length;
  const std = Math.sqrt(allReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / allReturns.length) || 0.001;
  
  const likelihoodUp = gaussian(currentReturn, mean, std);
  const likelihoodDown = gaussian(-currentReturn, mean, std);
  
  return Math.log(pUp * likelihoodUp + 0.001) - Math.log(pDown * likelihoodDown + 0.001);
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

export interface StratIter93CParams extends StrategyParams {
  window_size: number;
  up_threshold: number;
  down_threshold: number;
  score_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter93CStrategy extends BaseIterStrategy<StratIter93CParams> {
  constructor(params: Partial<StratIter93CParams> = {}) {
    super('strat_iter93_c.params.json', {
      window_size: 20,
      up_threshold: 0.01,
      down_threshold: 0.01,
      score_threshold: 0.5,
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
    const nbScore = naiveBayesScore(series.closes, this.params.window_size, this.params.up_threshold, this.params.down_threshold);

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

    if (shouldSkipPrice(bar.close) || !sr || nbScore === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const bayesBuy = nbScore > this.params.score_threshold;

    if (nearSupport && stochOversold && bayesBuy) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
