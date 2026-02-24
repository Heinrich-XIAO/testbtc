import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter32AParams extends StrategyParams {
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  support_threshold: number;
  resistance_threshold: number;
  atr_period: number;
  atr_regime_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter32AParams = {
  stoch_k_period: 14,
  stoch_d_period: 3,
  stoch_oversold: 18,
  support_threshold: 0.01,
  resistance_threshold: 0.98,
  atr_period: 14,
  atr_regime_threshold: 0.03,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 32,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter32AParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter32_a.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StratIter32AStrategy implements Strategy {
  params: StratIter32AParams;
  private closeHistory: Map<string, number[]> = new Map();
  private highHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private trHistory: Map<string, number[]> = new Map();
  private prevClose: Map<string, number | null> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private dValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter32AParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter32AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateStochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period) return null;
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    const close = closes[closes.length - 1];
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  private calculateStochasticD(kValues: number[], period: number): number | null {
    if (kValues.length < period) return null;
    const slice = kValues.slice(-period);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  }

  private calculateSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } {
    const lowSlice = lows.slice(-lookback);
    const highSlice = highs.slice(-lookback);
    return {
      support: Math.min(...lowSlice),
      resistance: Math.max(...highSlice),
    };
  }

  private calculateTrueRange(bar: Bar, prevClose: number | null): number {
    if (prevClose === null) return bar.high - bar.low;
    const range1 = bar.high - bar.low;
    const range2 = Math.abs(bar.high - prevClose);
    const range3 = Math.abs(bar.low - prevClose);
    return Math.max(range1, range2, range3);
  }

  private calculateATR(trHistory: number[], period: number): number | null {
    if (trHistory.length < period) return null;
    const slice = trHistory.slice(-period);
    return slice.reduce((sum, tr) => sum + tr, 0) / period;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closeHistory.has(bar.tokenId)) {
      this.closeHistory.set(bar.tokenId, []);
      this.highHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.trHistory.set(bar.tokenId, []);
      this.prevClose.set(bar.tokenId, null);
      this.kValues.set(bar.tokenId, []);
      this.dValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closeHistory.get(bar.tokenId)!;
    const highs = this.highHistory.get(bar.tokenId)!;
    const lows = this.lowHistory.get(bar.tokenId)!;
    const trs = this.trHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const dVals = this.dValues.get(bar.tokenId)!;

    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 240) closes.shift();
    if (highs.length > 240) highs.shift();
    if (lows.length > 240) lows.shift();

    const tr = this.calculateTrueRange(bar, this.prevClose.get(bar.tokenId) ?? null);
    trs.push(tr);
    if (trs.length > 240) trs.shift();
    this.prevClose.set(bar.tokenId, bar.close);

    const k = this.calculateStochasticK(closes, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 120) kVals.shift();

      const d = this.calculateStochasticD(kVals, this.params.stoch_d_period);
      if (d !== null) {
        dVals.push(d);
        if (dVals.length > 120) dVals.shift();
      }
    }

    const atr = this.calculateATR(trs, this.params.atr_period);
    const canCalcSR = highs.length >= this.params.sr_lookback && lows.length >= this.params.sr_lookback;
    const position = ctx.getPosition(bar.tokenId);

    if (!canCalcSR) return;

    const sr = this.calculateSupportResistance(highs, lows, this.params.sr_lookback);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);

      if (entry === undefined || entryBarNum === undefined) return;

      if (bar.low <= entry * (1 - this.params.stop_loss)) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.entryBar.delete(bar.tokenId);
        return;
      }

      if (bar.high >= entry * (1 + this.params.profit_target)) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.entryBar.delete(bar.tokenId);
        return;
      }

      if (bar.close >= sr.resistance * this.params.resistance_threshold) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.entryBar.delete(bar.tokenId);
        return;
      }

      if (barNum - entryBarNum >= this.params.max_hold_bars) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.entryBar.delete(bar.tokenId);
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (atr === null) return;
    if (kVals.length < 2 || dVals.length < 2) return;

    const atrRegime = atr / bar.close;
    const lowVolatilityRegime = atrRegime <= this.params.atr_regime_threshold;
    if (!lowVolatilityRegime) return;

    const prevK = kVals[kVals.length - 2];
    const prevD = dVals[dVals.length - 2];
    const currK = kVals[kVals.length - 1];
    const currD = dVals[dVals.length - 1];

    const stochCrossUp = prevK <= prevD && currK > currD;
    const nearOversold = currK <= this.params.stoch_oversold;
    const supportGap = Math.abs(bar.close - sr.support) / Math.max(sr.support, 1e-9);
    const nearSupport = supportGap <= this.params.support_threshold;

    if (stochCrossUp && nearOversold && nearSupport) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
