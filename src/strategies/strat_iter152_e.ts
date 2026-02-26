import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
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

function figarchLongMemory(returns: number[], lookback: number): number | null {
  if (returns.length < lookback + 10) return null;
  const slice = returns.slice(-lookback);
  const squaredReturns = slice.map(r => r * r);
  const meanSq = squaredReturns.reduce((a, b) => a + b, 0) / squaredReturns.length;
  if (meanSq === 0) return 0;
  const logMeanSq = Math.log(meanSq);
  const acf: number[] = [];
  for (let lag = 1; lag <= Math.min(lookback >> 1, 20); lag++) {
    let cov = 0;
    for (let i = 0; i < lookback - lag; i++) {
      cov += (squaredReturns[i] - meanSq) * (squaredReturns[i + lag] - meanSq);
    }
    cov /= lookback;
    const varSq = squaredReturns.map(x => (x - meanSq) ** 2).reduce((a, b) => a + b, 0) / lookback;
    acf.push(varSq > 0 ? cov / varSq : 0);
  }
  if (acf.length < 5) return null;
  let sumLogLag = 0;
  let validLags = 0;
  for (let i = 0; i < acf.length; i++) {
    const lag = i + 1;
    if (acf[i] > 0.01) {
      sumLogLag += Math.log(lag) * acf[i];
      validLags++;
    }
  }
  if (validLags < 3) return 0;
  const d = Math.min(0.45, Math.max(0.05, sumLogLag / validLags * 2));
  return d;
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
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : bar.close;
    const ret = (bar.close - prevClose) / prevClose;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    capPush(s.returns, ret);
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

export interface StratIter152EParams extends StrategyParams {
  figarch_lookback: number;
  long_memory_threshold: number;
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter152EStrategy extends BaseIterStrategy<StratIter152EParams> {
  private kVals: Map<string, number[]> = new Map();
  constructor(params: Partial<StratIter152EParams> = {}) {
    super('strat_iter152_e.params.json', {
      figarch_lookback: 40,
      long_memory_threshold: 0.25,
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 24,
      risk_percent: 0.25,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId)!;
      const ebar = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= entry * (1 - this.params.stop_loss) || bar.high >= entry * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - ebar >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || series.returns.length < this.params.figarch_lookback + 10) return;
    const d = figarchLongMemory(series.returns, this.params.figarch_lookback);
    if (d === null) return;

    const longMemoryDetected = d >= this.params.long_memory_threshold;
    const nearSupport = bar.low <= sr.support * 1.02;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    if (longMemoryDetected && nearSupport && stochRecover) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}
