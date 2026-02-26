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

interface GARCHState {
  omega: number;
  alpha: number;
  beta: number;
  variance: number;
  initialized: boolean;
}

function initGARCH(omega: number, alpha: number, beta: number): GARCHState {
  return {
    omega,
    alpha,
    beta,
    variance: 0.0001,
    initialized: false,
  };
}

function updateGARCH(state: GARCHState, returns: number): number {
  if (!state.initialized) {
    state.variance = returns * returns;
    state.initialized = true;
    return Math.sqrt(state.variance);
  }
  const prevVariance = state.variance;
  const prevReturnSq = returns * returns;
  state.variance = state.omega + state.alpha * prevReturnSq + state.beta * prevVariance;
  state.variance = Math.max(state.variance, 1e-8);
  return Math.sqrt(state.variance);
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

export interface StratIter152AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  garch_omega: number;
  garch_alpha: number;
  garch_beta: number;
  vol_shift_threshold: number;
  shift_confirm_bars: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter152AStrategy extends BaseIterStrategy<StratIter152AParams> {
  private kVals: Map<string, number[]> = new Map();
  private garchStates: Map<string, GARCHState> = new Map();
  private volHistory: Map<string, number[]> = new Map();
  private volRegime: Map<string, 'low' | 'high'> = new Map();
  private shiftConfirmed: Map<string, number> = new Map();
  private regimeInitialized: Map<string, boolean> = new Map();

  constructor(params: Partial<StratIter152AParams> = {}) {
    super(
      'strat_iter152_a.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 18,
        garch_omega: 0.00001,
        garch_alpha: 0.08,
        garch_beta: 0.90,
        vol_shift_threshold: 1.35,
        shift_confirm_bars: 2,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.garchStates.has(bar.tokenId)) {
      this.garchStates.set(bar.tokenId, initGARCH(this.params.garch_omega, this.params.garch_alpha, this.params.garch_beta));
    }
    if (!this.volHistory.has(bar.tokenId)) this.volHistory.set(bar.tokenId, []);
    if (!this.regimeInitialized.has(bar.tokenId)) this.regimeInitialized.set(bar.tokenId, false);

    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;

    const garchState = this.garchStates.get(bar.tokenId)!;
    const volHist = this.volHistory.get(bar.tokenId)!;

    if (series.closes.length >= 2) {
      const prevClose = series.closes[series.closes.length - 2];
      const returns = (bar.close - prevClose) / Math.max(prevClose, 1e-9);
      const vol = updateGARCH(garchState, returns);
      capPush(volHist, vol);

      if (volHist.length >= 20) {
        const recentVol = volHist.slice(-10);
        const olderVol = volHist.slice(-20, -10);
        const avgRecentVol = recentVol.reduce((a, b) => a + b, 0) / recentVol.length;
        const avgOlderVol = olderVol.reduce((a, b) => a + b, 0) / olderVol.length;

        if (avgOlderVol > 0) {
          const volShift = avgRecentVol / avgOlderVol;
          const isInitialized = this.regimeInitialized.get(bar.tokenId)!;
          let newRegime: 'low' | 'high' | null = null;

          if (volShift >= this.params.vol_shift_threshold) {
            newRegime = 'high';
          } else if (volShift <= 1 / this.params.vol_shift_threshold) {
            newRegime = 'low';
          }

          if (newRegime !== null) {
            const currentRegime = this.volRegime.get(bar.tokenId);
            if (!isInitialized) {
              this.volRegime.set(bar.tokenId, newRegime);
              this.regimeInitialized.set(bar.tokenId, true);
              this.shiftConfirmed.set(bar.tokenId, barNum);
            } else if (currentRegime && newRegime !== currentRegime) {
              const prevConfirm = this.shiftConfirmed.get(bar.tokenId) || 0;
              if (barNum >= prevConfirm + this.params.shift_confirm_bars) {
                this.volRegime.set(bar.tokenId, newRegime);
                this.shiftConfirmed.set(bar.tokenId, barNum);
              }
            }
          }
        }
      }
    }

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || volHist.length < 25) return;

    const regime = this.volRegime.get(bar.tokenId)!;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;

    const recentVol = volHist.slice(-5);
    const avgVol = recentVol.reduce((a, b) => a + b, 0) / recentVol.length;
    const volLevel = avgVol * Math.sqrt(24);

    const volExpansion = regime === 'high';
    const lowVolBaseline = volLevel < 0.015;
    const appropriateRegime = volExpansion || lowVolBaseline;

    if (nearSupport && stochRecover && appropriateRegime) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
