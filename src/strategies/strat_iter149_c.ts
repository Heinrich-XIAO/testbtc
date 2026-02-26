import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter149CParams extends StrategyParams {
  gap_threshold: number;
  fade_window: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter149CParams = {
  gap_threshold: 0.03,
  fade_window: 3,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.12,
  max_hold_bars: 20,
  risk_percent: 0.20,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter149CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter149_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter149CStrategy implements Strategy {
  params: StratIter149CParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();
  private gapDetected: Map<string, { barNum: number; gapSize: number }> = new Map();

  constructor(params: Partial<StratIter149CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter149CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period) return null;
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
  }

  private supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
    if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
    return {
      support: Math.min(...lows.slice(-(lookback + 1), -1)),
      resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
    };
  }

  private detectGap(closes: number[], highs: number[], lows: number[], threshold: number): { isGap: boolean; gapSize: number; direction: number } | null {
    if (closes.length < 2 || highs.length < 2 || lows.length < 2) return null;
    const prevHigh = highs[highs.length - 2];
    const prevLow = lows[lows.length - 2];
    const currOpen = closes[closes.length - 1];
    const gapDown = prevLow - currOpen;
    const gapUp = currOpen - prevHigh;
    if (gapDown > prevLow * threshold) {
      return { isGap: true, gapSize: gapDown / prevLow, direction: -1 };
    }
    if (gapUp > currOpen * threshold) {
      return { isGap: true, gapSize: gapUp / currOpen, direction: 1 };
    }
    return { isGap: false, gapSize: 0, direction: 0 };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
      this.gapDetected.set(bar.tokenId, { barNum: -999, gapSize: 0 });
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 300) closes.shift();
    if (highs.length > 300) highs.shift();
    if (lows.length > 300) lows.shift();

    const gap = this.detectGap(closes, highs, lows, this.params.gap_threshold);
    if (gap && gap.isGap && gap.direction < 0) {
      this.gapDetected.set(bar.tokenId, { barNum, gapSize: gap.gapSize });
    }

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
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
        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (closes.length < 14) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const k = this.stochasticK(closes, highs, lows, 14);
    const gapInfo = this.gapDetected.get(bar.tokenId)!;
    const withinFadeWindow = barNum - gapInfo.barNum <= this.params.fade_window;
    const nearSupport = bar.low <= sr.support * 1.02;
    const stochOversold = k !== null && k < this.params.stoch_oversold;

    if (withinFadeWindow && nearSupport && stochOversold) {
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
