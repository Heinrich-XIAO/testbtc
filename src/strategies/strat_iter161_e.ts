import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter161EParams extends StrategyParams {
  cci_period: number;
  cci_oversold: number;
  cci_momentum_threshold: number;
  sr_lookback: number;
  support_zone_threshold: number;
  min_support_touches: number;
  resistance_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter161EParams = {
  cci_period: 14,
  cci_oversold: -100,
  cci_momentum_threshold: 0,
  sr_lookback: 50,
  support_zone_threshold: 0.01,
  min_support_touches: 2,
  resistance_threshold: 0.985,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter161EParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter161_e.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter161EStrategy implements Strategy {
  params: StratIter161EParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private cciValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter161EParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter161EParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private typicalPrice(high: number, low: number, close: number): number {
    return (high + low + close) / 3;
  }

  private calculateCCI(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period || highs.length < period || lows.length < period) return null;
    
    const tps: number[] = [];
    for (let i = 0; i < period; i++) {
      const idx = closes.length - period + i;
      tps.push(this.typicalPrice(highs[idx], lows[idx], closes[idx]));
    }
    
    const sma = tps.reduce((a, b) => a + b, 0) / period;
    
    let meanDeviation = 0;
    for (const tp of tps) {
      meanDeviation += Math.abs(tp - sma);
    }
    meanDeviation /= period;
    
    if (meanDeviation === 0) return 0;
    
    const currentTP = this.typicalPrice(
      highs[highs.length - 1],
      lows[lows.length - 1],
      closes[closes.length - 1]
    );
    
    return (currentTP - sma) / (0.015 * meanDeviation);
  }

  private supportFromPriorBars(lows: number[], lookback: number): number | null {
    if (lows.length < lookback + 1) return null;
    return Math.min(...lows.slice(-(lookback + 1), -1));
  }

  private resistanceFromPriorBars(highs: number[], lookback: number): number | null {
    if (highs.length < lookback + 1) return null;
    return Math.max(...highs.slice(-(lookback + 1), -1));
  }

  private countSupportTouches(lows: number[], support: number, lookback: number, zoneThreshold: number): number {
    if (support <= 0 || lows.length < lookback + 1) return 0;
    const recentLows = lows.slice(-(lookback + 1), -1);
    return recentLows.reduce((count, low) => {
      const distance = Math.abs(low - support) / support;
      return distance <= zoneThreshold ? count + 1 : count;
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
      this.cciValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const cciVals = this.cciValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);

    if (closes.length > 320) closes.shift();
    if (highs.length > 320) highs.shift();
    if (lows.length > 320) lows.shift();

    const cci = this.calculateCCI(closes, highs, lows, this.params.cci_period);
    if (cci !== null) {
      cciVals.push(cci);
      if (cciVals.length > 320) cciVals.shift();
    }

    const support = this.supportFromPriorBars(lows, this.params.sr_lookback);
    const resistance = this.resistanceFromPriorBars(highs, this.params.sr_lookback);

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

      if (resistance !== null && bar.high >= resistance * this.params.resistance_threshold) {
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
    if (cciVals.length < 2) return;

    const supportTouches = this.countSupportTouches(
      lows,
      support,
      this.params.sr_lookback,
      this.params.support_zone_threshold
    );
    if (supportTouches < this.params.min_support_touches) return;

    const prevCCI = cciVals[cciVals.length - 2];
    const currCCI = cciVals[cciVals.length - 1];
    
    const cciOversold = currCCI <= this.params.cci_oversold;
    if (!cciOversold) return;
    
    const momentumTurnsPositive = prevCCI < this.params.cci_momentum_threshold && currCCI >= this.params.cci_momentum_threshold;
    if (!momentumTurnsPositive) return;

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
