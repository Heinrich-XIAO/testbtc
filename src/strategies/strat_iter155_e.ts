import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter155EParams extends StrategyParams {
  vacuum_lookback: number;
  vacuum_threshold: number;
  vacuum_min_range: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  sr_lookback: number;
  min_support_touches: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter155EParams = {
  vacuum_lookback: 20,
  vacuum_threshold: 0.025,
  vacuum_min_range: 0.008,
  stoch_k_period: 14,
  stoch_oversold: 16,
  stoch_overbought: 84,
  sr_lookback: 50,
  min_support_touches: 2,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter155EParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter155_e.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter155EStrategy implements Strategy {
  params: StratIter155EParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();
  private vacuumDetected: Map<string, boolean> = new Map();

  constructor(params: Partial<StratIter155EParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter155EParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period || highs.length < period || lows.length < period) return null;
    const windowHigh = Math.max(...highs.slice(-period));
    const windowLow = Math.min(...lows.slice(-period));
    if (windowHigh === windowLow) return 50;
    return ((closes[closes.length - 1] - windowLow) / (windowHigh - windowLow)) * 100;
  }

  private detectVacuum(closes: number[], highs: number[], lows: number[], lookback: number): boolean {
    if (closes.length < lookback + 2) return false;
    
    const recentCloses = closes.slice(-lookback);
    const recentHighs = highs.slice(-lookback);
    const recentLows = lows.slice(-lookback);
    
    const avgRange = recentHighs.reduce((sum, h, i) => sum + (h - recentLows[i]), 0) / lookback;
    const avgPrice = recentCloses.reduce((a, b) => a + b, 0) / lookback;
    
    if (avgPrice < 0.05 || avgPrice > 0.95) return false;
    if (avgRange / avgPrice < this.params.vacuum_min_range) return false;
    
    const lastClose = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2];
    const priceChange = Math.abs(lastClose - prevClose) / prevClose;
    
    const lastHigh = highs[highs.length - 1];
    const lastLow = lows[lows.length - 1];
    const barRange = (lastHigh - lastLow) / lastClose;
    
    const vacuumSignal = priceChange >= this.params.vacuum_threshold && barRange < avgRange / avgPrice * 1.5;
    
    return vacuumSignal;
  }

  private supportFromPriorBars(lows: number[], lookback: number): number | null {
    if (lows.length < lookback + 1) return null;
    return Math.min(...lows.slice(-(lookback + 1), -1));
  }

  private countSupportTouches(lows: number[], support: number, lookback: number): number {
    if (support <= 0 || lows.length < lookback + 1) return 0;
    const recentLows = lows.slice(-(lookback + 1), -1);
    return recentLows.reduce((count, low) => {
      const distance = Math.abs(low - support) / support;
      return distance <= 0.01 ? count + 1 : count;
    }, 0);
  }

  private clearPositionTracking(tokenId: string): void {
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
      this.vacuumDetected.set(bar.tokenId, false);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);

    if (closes.length > 320) closes.shift();
    if (highs.length > 320) highs.shift();
    if (lows.length > 320) lows.shift();

    const k = this.stochasticK(closes, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 320) kVals.shift();
    }

    const vacuum = this.detectVacuum(closes, highs, lows, this.params.vacuum_lookback);
    this.vacuumDetected.set(bar.tokenId, vacuum);

    const support = this.supportFromPriorBars(lows, this.params.sr_lookback);

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBarNum === undefined) return;

      if (bar.low <= entry * (1 - this.params.stop_loss)) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
        return;
      }

      if (bar.high >= entry * (1 + this.params.profit_target)) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
        return;
      }

      if (barNum - entryBarNum >= this.params.max_hold_bars) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (support === null) return;
    if (kVals.length < 2) return;

    const supportTouches = this.countSupportTouches(lows, support, this.params.sr_lookback);
    if (supportTouches < this.params.min_support_touches) return;

    const inVacuum = this.vacuumDetected.get(bar.tokenId) || false;
    if (!inVacuum) return;

    const prevK = kVals[kVals.length - 2];
    const currK = kVals[kVals.length - 1];
    const stochCrossUp = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
    if (!stochCrossUp) return;

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

  onComplete(_ctx: BacktestContext): void {}
}
