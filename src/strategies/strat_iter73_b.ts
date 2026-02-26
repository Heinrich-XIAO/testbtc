import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter73BParams extends StrategyParams {
  lag: number;
  bin_count: number;
  window_size: number;
  mi_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter73BParams = {
  lag: 2,
  bin_count: 7,
  window_size: 40,
  mi_threshold: 0.10,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter73BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter73_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter73BStrategy implements Strategy {
  params: StratIter73BParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter73BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter73BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number = 14): number | null {
    if (closes.length < period || highs.length < period || lows.length < period) return null;
    const windowHigh = Math.max(...highs.slice(-period));
    const windowLow = Math.min(...lows.slice(-period));
    if (windowHigh === windowLow) return 50;
    return ((closes[closes.length - 1] - windowLow) / (windowHigh - windowLow)) * 100;
  }

  private supportFromPriorBars(lows: number[], lookback: number): number | null {
    if (lows.length < lookback + 1) return null;
    return Math.min(...lows.slice(-(lookback + 1), -1));
  }

  private calculateReturns(closes: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    return returns;
  }

  private discretize(values: number[], binCount: number): number[] {
    if (values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / binCount;
    
    return values.map(v => {
      if (binWidth === 0) return 0;
      const bin = Math.floor((v - min) / binWidth);
      return Math.min(bin, binCount - 1);
    });
  }

  private calculateMutualInformation(x: number[], y: number[], binCount: number): number | null {
    if (x.length !== y.length || x.length < 10) return null;

    const jointCounts: Map<string, number> = new Map();
    const xCounts: Map<number, number> = new Map();
    const yCounts: Map<number, number> = new Map();
    const n = x.length;

    for (let i = 0; i < n; i++) {
      const xi = x[i];
      const yi = y[i];
      const key = `${xi},${yi}`;
      
      jointCounts.set(key, (jointCounts.get(key) || 0) + 1);
      xCounts.set(xi, (xCounts.get(xi) || 0) + 1);
      yCounts.set(yi, (yCounts.get(yi) || 0) + 1);
    }

    let mi = 0;
    for (const [key, jointCount] of jointCounts) {
      const [xiStr, yiStr] = key.split(',');
      const xi = parseInt(xiStr, 10);
      const yi = parseInt(yiStr, 10);
      
      const pxy = jointCount / n;
      const px = (xCounts.get(xi) || 0) / n;
      const py = (yCounts.get(yi) || 0) / n;
      
      if (px > 0 && py > 0 && pxy > 0) {
        mi += pxy * Math.log(pxy / (px * py));
      }
    }

    return mi;
  }

  private calculateMI(closes: number[], lag: number, binCount: number, windowSize: number): number | null {
    if (closes.length < windowSize + lag + 2) return null;
    
    const recentCloses = closes.slice(-windowSize);
    const returns = this.calculateReturns(recentCloses);
    
    if (returns.length < lag + 5) return null;
    
    const x: number[] = [];
    const y: number[] = [];
    
    for (let i = lag; i < returns.length; i++) {
      x.push(returns[i - lag]);
      y.push(returns[i]);
    }
    
    const xDiscrete = this.discretize(x, binCount);
    const yDiscrete = this.discretize(y, binCount);
    
    return this.calculateMutualInformation(xDiscrete, yDiscrete, binCount);
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
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);

    if (closes.length > 320) closes.shift();
    if (highs.length > 320) highs.shift();
    if (lows.length > 320) lows.shift();

    const k = this.stochasticK(closes, highs, lows, 14);
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
    if (k === null) return;

    const supportDistance = (bar.close - support) / support;
    if (supportDistance > 0.05) return;

    if (k >= this.params.stoch_oversold) return;

    const mi = this.calculateMI(
      closes,
      this.params.lag,
      this.params.bin_count,
      this.params.window_size
    );

    if (mi === null) return;
    if (mi < this.params.mi_threshold) return;

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
