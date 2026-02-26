import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter86DParams extends StrategyParams {
  window_size: number;
  theta_threshold: number;
  deviation_k: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter86DParams = {
  window_size: 30,
  theta_threshold: 0.05,
  deviation_k: 2.0,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter86DParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter86_d.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter86DStrategy implements Strategy {
  params: StratIter86DParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter86DParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter86DParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private mean(data: number[]): number {
    return data.reduce((a, b) => a + b, 0) / data.length;
  }

  private stdDev(data: number[], meanVal: number): number {
    const squaredDiffs = data.map(v => Math.pow(v - meanVal, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / data.length);
  }

  private autocorrelation(data: number[], lag: number): number {
    if (data.length <= lag) return 0;
    const n = data.length;
    const mu = this.mean(data);
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      denominator += Math.pow(data[i] - mu, 2);
    }
    if (denominator === 0) return 0;
    for (let i = lag; i < n; i++) {
      numerator += (data[i] - mu) * (data[i - lag] - mu);
    }
    return numerator / denominator;
  }

  private estimateTheta(data: number[]): number {
    const rho1 = this.autocorrelation(data, 1);
    if (rho1 >= 1 || rho1 <= -1) return 0;
    if (rho1 <= 0) return 0;
    return -Math.log(rho1);
  }

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period) return null;
    const windowHigh = Math.max(...highs.slice(-period));
    const windowLow = Math.min(...lows.slice(-period));
    if (windowHigh === windowLow) return 50;
    return ((closes[closes.length - 1] - windowLow) / (windowHigh - windowLow)) * 100;
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
    if (closes.length > 400) closes.shift();
    if (highs.length > 400) highs.shift();
    if (lows.length > 400) lows.shift();

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

      if (barNum - entryBarNum >= this.params.max_hold_bars) {
        this.closePosition(ctx, bar.tokenId);
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (closes.length < this.params.window_size) return;
    if (highs.length < this.params.sr_lookback || lows.length < this.params.sr_lookback) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    if (sr.support <= 0) return;

    const window = closes.slice(-this.params.window_size);
    const mu = this.mean(window);
    const sigma = this.stdDev(window, mu);
    
    if (sigma <= 0) return;

    const theta = this.estimateTheta(window);
    
    if (theta < this.params.theta_threshold) return;

    const lowerBound = mu - this.params.deviation_k * sigma;

    const k = this.stochasticK(closes, highs, lows, 14);

    if (bar.close < lowerBound && k !== null && k <= this.params.stoch_oversold) {
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
