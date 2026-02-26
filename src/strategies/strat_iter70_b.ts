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

type PriceState = 'up' | 'down' | 'flat';

function discretizePriceChange(change: number, threshold: number = 0.005): PriceState {
  if (change > threshold) return 'up';
  if (change < -threshold) return 'flat';
  return 'flat';
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

export interface StratIter70BParams extends StrategyParams {
  lookback_bars: number;
  regime_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter70BStrategy extends BaseIterStrategy<StratIter70BParams> {
  private kVals: Map<string, number[]> = new Map();
  private priceChanges: Map<string, number[]> = new Map();
  private transitionMatrix: Map<string, Map<PriceState, Map<PriceState, number>>> = new Map();
  private prevState: Map<string, PriceState> = new Map();
  private regimeProb: Map<string, number> = new Map();

  constructor(params: Partial<StratIter70BParams> = {}) {
    super('strat_iter70_b.params.json', {
      lookback_bars: 40,
      regime_threshold: 0.60,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  private initializeTransitionMatrix(tokenId: string): void {
    if (!this.transitionMatrix.has(tokenId)) {
      const matrix = new Map<PriceState, Map<PriceState, number>>();
      const states: PriceState[] = ['up', 'down', 'flat'];
      for (const from of states) {
        matrix.set(from, new Map());
        for (const to of states) {
          matrix.get(from)!.set(to, 1);
        }
      }
      this.transitionMatrix.set(tokenId, matrix);
    }
  }

  private updateTransitionMatrix(tokenId: string, from: PriceState, to: PriceState): void {
    this.initializeTransitionMatrix(tokenId);
    const matrix = this.transitionMatrix.get(tokenId)!;
    matrix.get(from)!.set(to, (matrix.get(from)!.get(to) || 0) + 1);
  }

  private buildTransitionMatrixFromHistory(tokenId: string, changes: number[]): void {
    this.initializeTransitionMatrix(tokenId);
    const matrix = this.transitionMatrix.get(tokenId)!;
    const states: PriceState[] = ['up', 'down', 'flat'];
    for (const from of states) {
      for (const to of states) {
        matrix.get(from)!.set(to, 1);
      }
    }

    for (let i = 1; i < changes.length; i++) {
      const from = discretizePriceChange(changes[i - 1]);
      const to = discretizePriceChange(changes[i]);
      matrix.get(from)!.set(to, (matrix.get(from)!.get(to) || 0) + 1);
    }
  }

  private getTransitionProbability(tokenId: string, from: PriceState, to: PriceState): number {
    this.initializeTransitionMatrix(tokenId);
    const matrix = this.transitionMatrix.get(tokenId)!;
    const row = matrix.get(from)!;
    const total = (row.get('up') || 0) + (row.get('down') || 0) + (row.get('flat') || 0);
    if (total === 0) return 1 / 3;
    return (row.get(to) || 0) / total;
  }

  private computeUptickRegimeProbability(tokenId: string, currentState: PriceState): number {
    const probUpGivenCurrent = this.getTransitionProbability(tokenId, currentState, 'up');
    const probUpFromFlat = this.getTransitionProbability(tokenId, 'flat', 'up');
    const probUpFromDown = this.getTransitionProbability(tokenId, 'down', 'up');
    
    const regimeProb = probUpGivenCurrent * 0.5 + 
                       probUpFromFlat * 0.3 + 
                       probUpFromDown * 0.2;
    
    return regimeProb;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) {
      this.kVals.set(bar.tokenId, []);
      this.priceChanges.set(bar.tokenId, []);
    }
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const changes = this.priceChanges.get(bar.tokenId)!;
    if (series.closes.length >= 2) {
      const prevClose = series.closes[series.closes.length - 2];
      const change = (bar.close - prevClose) / prevClose;
      capPush(changes, change, this.params.lookback_bars + 10);

      if (changes.length >= this.params.lookback_bars) {
        this.buildTransitionMatrixFromHistory(bar.tokenId, changes);
      }

      const currentState = discretizePriceChange(change);
      const regimeProbability = this.computeUptickRegimeProbability(bar.tokenId, currentState);
      this.regimeProb.set(bar.tokenId, regimeProbability);
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

    if (shouldSkipPrice(bar.close) || !sr || kv.length < 2 || changes.length < this.params.lookback_bars) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = kv[kv.length - 1] < this.params.stoch_oversold;
    const regimeProbability = this.regimeProb.get(bar.tokenId) || 0;
    const regimeShift = regimeProbability >= this.params.regime_threshold;

    if (nearSupport && stochOversold && regimeShift) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
