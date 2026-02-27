import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter165BParams extends StrategyParams {
  volume_threshold: number;
  volume_lookback: number;
  stoch_oversold: number;
  stoch_overbought: number;
  max_lookback: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter165BParams = {
  volume_threshold: 1.5,
  volume_lookback: 20,
  stoch_oversold: 20,
  stoch_overbought: 80,
  max_lookback: 50,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 25,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter165BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter165_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter165BStrategy implements Strategy {
  params: StratIter165BParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private volumes: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter165BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter165BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period || highs.length < period || lows.length < period) return null;
    const windowHigh = Math.max(...highs.slice(-period));
    const windowLow = Math.min(...lows.slice(-period));
    if (windowHigh === windowLow) return 50;
    return ((closes[closes.length - 1] - windowLow) / (windowHigh - windowLow)) * 100;
  }

  private calculateVolume(closes: number[], highs: number[], lows: number[]): number {
    if (closes.length < 2) return 0;
    const range = highs[highs.length - 1] - lows[lows.length - 1];
    const priceChange = Math.abs(closes[closes.length - 1] - closes[closes.length - 2]);
    return range * priceChange * 1000;
  }

  private priorSupport(lows: number[], lookback: number): number | null {
    if (lows.length < lookback + 1) return null;
    return Math.min(...lows.slice(-(lookback + 1), -1));
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
      this.volumes.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const volumes = this.volumes.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);

    if (closes.length > 100) closes.shift();
    if (highs.length > 100) highs.shift();
    if (lows.length > 100) lows.shift();

    const volume = this.calculateVolume(closes, highs, lows);
    volumes.push(volume);
    if (volumes.length > 50) volumes.shift();

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
    if (closes.length < this.params.max_lookback + 1) return;
    if (volumes.length < this.params.volume_lookback) return;

    const k = this.stochasticK(closes, highs, lows, 14);
    if (k === null) return;
    if (k > this.params.stoch_oversold) return;

    const avgVolume = volumes.slice(-this.params.volume_lookback).reduce((a, b) => a + b, 0) / this.params.volume_lookback;
    if (avgVolume === 0) return;
    const currentVolume = volumes[volumes.length - 1];
    if (currentVolume < avgVolume * this.params.volume_threshold) return;

    const support = this.priorSupport(lows, this.params.max_lookback);
    if (support === null) return;
    if (bar.low > support * 1.02) return;

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
