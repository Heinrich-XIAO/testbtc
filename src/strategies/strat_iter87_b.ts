import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  regimeMean: number;
  regimeStd: number;
  lastRegimeBar: number;
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

function computeStats(prices: number[]): { mean: number; std: number } {
  if (prices.length === 0) return { mean: 0, std: 0 };
  const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
  if (prices.length < 2) return { mean, std: 0 };
  const variance = prices.reduce((s, v) => s + (v - mean) ** 2, 0) / prices.length;
  return { mean, std: Math.sqrt(variance) };
}

function detectRegimeSwitch(
  closes: number[],
  window: number,
  threshold: number
): { switched: boolean; newMean: number; newStd: number; isNegative: boolean } {
  if (closes.length < window * 2) {
    return { switched: false, newMean: 0, newStd: 0, isNegative: false };
  }

  const recentWindow = closes.slice(-window);
  const prevWindow = closes.slice(-(window * 2), -window);

  const recent = computeStats(recentWindow);
  const prev = computeStats(prevWindow);

  if (prev.std <= 1e-9) {
    return { switched: false, newMean: recent.mean, newStd: recent.std, isNegative: false };
  }

  const meanDiff = recent.mean - prev.mean;
  const normalizedDiff = Math.abs(meanDiff) / prev.std;

  const switched = normalizedDiff > threshold;
  const isNegative = meanDiff < 0;

  return { switched, newMean: recent.mean, newStd: recent.std, isNegative };
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
      this.series.set(bar.tokenId, {
        closes: [], highs: [], lows: [],
        regimeMean: 0, regimeStd: 0, lastRegimeBar: -999
      });
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

export interface StratIter87BParams extends StrategyParams {
  regime_window: number;
  switch_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const STOCH_K_PERIOD = 14;

export class StratIter87BStrategy extends BaseIterStrategy<StratIter87BParams> {
  private kVals: Map<string, number[]> = new Map();
  private regimeSwitchBar: Map<string, number> = new Map();
  private negativeRegime: Map<string, boolean> = new Map();

  constructor(params: Partial<StratIter87BParams> = {}) {
    super('strat_iter87_b.params.json', {
      regime_window: 30,
      switch_threshold: 2.0,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.negativeRegime.has(bar.tokenId)) this.negativeRegime.set(bar.tokenId, false);
    if (!this.regimeSwitchBar.has(bar.tokenId)) this.regimeSwitchBar.set(bar.tokenId, -999);

    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, STOCH_K_PERIOD);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const regimeResult = detectRegimeSwitch(
      series.closes,
      this.params.regime_window,
      this.params.switch_threshold
    );

    if (regimeResult.switched) {
      series.regimeMean = regimeResult.newMean;
      series.regimeStd = regimeResult.newStd;
      series.lastRegimeBar = barNum;
      this.regimeSwitchBar.set(bar.tokenId, barNum);
      this.negativeRegime.set(bar.tokenId, regimeResult.isNegative);
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

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 1) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = kv[kv.length - 1] < this.params.stoch_oversold;
    const justSwitched = barNum === this.regimeSwitchBar.get(bar.tokenId);
    const isNegRegime = this.negativeRegime.get(bar.tokenId)!;

    if (nearSupport && stochOversold && justSwitched && isNegRegime) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}

export default StratIter87BStrategy;
