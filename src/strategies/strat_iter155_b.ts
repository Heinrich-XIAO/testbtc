import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter155BParams extends StrategyParams {
  cum_vol_lookback: number;
  cum_vol_threshold: number;
  cum_vol_confirm_bars: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  spread_lookback: number;
  tight_spread_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter155BParams = {
  cum_vol_lookback: 24,
  cum_vol_threshold: 0.60,
  cum_vol_confirm_bars: 2,
  stoch_k_period: 14,
  stoch_oversold: 16,
  stoch_overbought: 84,
  spread_lookback: 20,
  tight_spread_threshold: 0.008,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter155BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter155_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter155BStrategy implements Strategy {
  params: StratIter155BParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private cumVol: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter155BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter155BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period || highs.length < period || lows.length < period) return null;
    const windowHigh = Math.max(...highs.slice(-period));
    const windowLow = Math.min(...lows.slice(-period));
    if (windowHigh === windowLow) return 50;
    return ((closes[closes.length - 1] - windowLow) / (windowHigh - windowLow)) * 100;
  }

  private estimateCumulativeVolume(closes: number[], lookback: number): number {
    if (closes.length < lookback + 1) return 0;
    
    let cumVol = 0;
    for (let i = closes.length - lookback; i < closes.length; i++) {
      if (i > 0) {
        const priceChange = (closes[i] - closes[i - 1]) / closes[i - 1];
        const direction = priceChange > 0 ? 1 : -1;
        const magnitude = Math.abs(priceChange);
        cumVol += direction * (1 + magnitude * 10);
      }
    }
    
    const maxPossibleCumVol = lookback;
    const normalizedCumVol = cumVol / maxPossibleCumVol;
    return normalizedCumVol;
  }

  private estimateSpreadFromPatterns(closes: number[], highs: number[], lows: number[], lookback: number): number {
    if (closes.length < lookback + 1) return 1;
    
    const recentCloses = closes.slice(-lookback);
    const recentHighs = highs.slice(-lookback);
    const recentLows = lows.slice(-lookback);
    
    const priceRange = (Math.max(...recentHighs) - Math.min(...recentLows)) / closes[closes.length - 1];
    
    const returns: number[] = [];
    for (let i = 1; i < recentCloses.length; i++) {
      returns.push(Math.abs((recentCloses[i] - recentCloses[i - 1]) / recentCloses[i - 1]));
    }
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    
    const closePositions = recentCloses.map((c, i) => c - recentLows[i]);
    const positionStd = this.standardDeviation(closePositions);
    const normalizedStd = positionStd / closes[closes.length - 1];
    
    const spreadEstimate = (priceRange * 0.5 + avgReturn * 0.3 + normalizedStd * 0.2);
    return spreadEstimate;
  }

  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
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
      this.cumVol.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const cumVols = this.cumVol.get(bar.tokenId)!;
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

    const cumVolume = this.estimateCumulativeVolume(closes, this.params.cum_vol_lookback);
    cumVols.push(cumVolume);
    if (cumVols.length > 320) cumVols.shift();

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
    if (closes.length < this.params.spread_lookback + 1) return;
    if (kVals.length < 2) return;
    if (cumVols.length < this.params.cum_vol_confirm_bars + 1) return;

    const spreadEstimate = this.estimateSpreadFromPatterns(closes, highs, lows, this.params.spread_lookback);
    if (spreadEstimate > this.params.tight_spread_threshold) return;

    const prevK = kVals[kVals.length - 2];
    const currK = kVals[kVals.length - 1];
    const stochCrossUp = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
    if (!stochCrossUp) return;

    const confirmBars = this.params.cum_vol_confirm_bars;
    let cumVolSignal = true;
    for (let i = 0; i <= confirmBars; i++) {
      const idx = cumVols.length - 1 - i;
      if (cumVols[idx] < this.params.cum_vol_threshold) {
        cumVolSignal = false;
        break;
      }
    }
    if (!cumVolSignal) return;

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
