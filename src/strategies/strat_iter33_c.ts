import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter33CParams extends StrategyParams {
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  support_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
  rsi_period: number;
  rsi_strong_trigger: number;
  rsi_medium_trigger: number;
  rsi_strong_exit: number;
  rsi_medium_exit: number;
  rsi_weak_exit: number;
  rsi_exit_min_hold_bars: number;
}

const defaultParams: StratIter33CParams = {
  stoch_k_period: 14,
  stoch_d_period: 3,
  stoch_oversold: 18,
  support_threshold: 0.012,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 32,
  risk_percent: 0.25,
  sr_lookback: 50,
  rsi_period: 14,
  rsi_strong_trigger: 60,
  rsi_medium_trigger: 52,
  rsi_strong_exit: 50,
  rsi_medium_exit: 44,
  rsi_weak_exit: 38,
  rsi_exit_min_hold_bars: 3,
};

function loadSavedParams(): Partial<StratIter33CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter33_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter33CStrategy implements Strategy {
  params: StratIter33CParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private dValues: Map<string, number[]> = new Map();
  private rsiValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private peakRsiSinceEntry: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter33CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter33CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period) return null;
    const recentHigh = Math.max(...highs.slice(-period));
    const recentLow = Math.min(...lows.slice(-period));
    if (recentHigh === recentLow) return 50;
    return ((closes[closes.length - 1] - recentLow) / (recentHigh - recentLow)) * 100;
  }

  private stochasticD(kValues: number[], period: number): number | null {
    if (kValues.length < period) return null;
    const window = kValues.slice(-period);
    return window.reduce((sum, v) => sum + v, 0) / period;
  }

  private rsi(closes: number[], period: number): number | null {
    if (closes.length < period + 1) return null;
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  private supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } {
    return {
      support: Math.min(...lows.slice(-lookback)),
      resistance: Math.max(...highs.slice(-lookback)),
    };
  }

  private closePosition(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.peakRsiSinceEntry.delete(tokenId);
  }

  private getRegimeExitThreshold(peakRsi: number): number {
    if (peakRsi >= this.params.rsi_strong_trigger) return this.params.rsi_strong_exit;
    if (peakRsi >= this.params.rsi_medium_trigger) return this.params.rsi_medium_exit;
    return this.params.rsi_weak_exit;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.dValues.set(bar.tokenId, []);
      this.rsiValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const dVals = this.dValues.get(bar.tokenId)!;
    const rsiVals = this.rsiValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 300) closes.shift();
    if (highs.length > 300) highs.shift();
    if (lows.length > 300) lows.shift();

    const k = this.stochasticK(closes, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 300) kVals.shift();
      const d = this.stochasticD(kVals, this.params.stoch_d_period);
      if (d !== null) {
        dVals.push(d);
        if (dVals.length > 300) dVals.shift();
      }
    }

    const rsi = this.rsi(closes, this.params.rsi_period);
    if (rsi !== null) {
      rsiVals.push(rsi);
      if (rsiVals.length > 300) rsiVals.shift();
    }

    if (highs.length < this.params.sr_lookback || lows.length < this.params.sr_lookback) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBarNum === undefined) return;

      if (bar.low <= entry * (1 - this.params.stop_loss)) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (bar.high >= entry * (1 + this.params.profit_target)) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (bar.close >= sr.resistance) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (barNum - entryBarNum >= this.params.max_hold_bars) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (rsi !== null) {
        const prevPeak = this.peakRsiSinceEntry.get(bar.tokenId) ?? rsi;
        const nextPeak = Math.max(prevPeak, rsi);
        this.peakRsiSinceEntry.set(bar.tokenId, nextPeak);

        const regimeThreshold = this.getRegimeExitThreshold(nextPeak);
        const heldBars = barNum - entryBarNum;
        const rsiRegimeBreak = heldBars >= this.params.rsi_exit_min_hold_bars && rsi < regimeThreshold;

        if (rsiRegimeBreak) {
          this.closePosition(ctx, bar.tokenId);
        }
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (kVals.length < 2 || dVals.length < 2) return;
    if (sr.support <= 0) return;

    const prevK = kVals[kVals.length - 2];
    const prevD = dVals[dVals.length - 2];
    const currK = kVals[kVals.length - 1];
    const currD = dVals[dVals.length - 1];

    const crossedUp = prevK <= prevD && currK > currD;
    const nearSupport = (bar.close - sr.support) / sr.support <= this.params.support_threshold;
    const oversold = currK <= this.params.stoch_oversold;

    if (crossedUp && nearSupport && oversold) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
          this.peakRsiSinceEntry.set(bar.tokenId, rsi ?? 50);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
