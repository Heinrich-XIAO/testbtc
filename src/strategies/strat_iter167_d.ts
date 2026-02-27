import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface RangeTradingParams extends StrategyParams {
  range_lookback: number;
  entry_threshold: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stoch_k_period: number;
  stop_loss: number;
  profit_target: number;
  risk_percent: number;
  max_hold_bars: number;
}

const defaultParams: RangeTradingParams = {
  range_lookback: 20,
  entry_threshold: 0.2,
  stoch_oversold: 20,
  stoch_overbought: 80,
  stoch_k_period: 14,
  stop_loss: 0.08,
  profit_target: 0.75,
  risk_percent: 0.25,
  max_hold_bars: 28,
};

function loadSavedParams(): Partial<RangeTradingParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter167_d.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

interface RangeData {
  rangeHigh: number;
  rangeLow: number;
  rangeMid: number;
  rangeSize: number;
}

export class RangeTradingStrategy implements Strategy {
  params: RangeTradingParams;
  private priceHistory: Map<string, number[]> = new Map();
  private highHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();
  private rangeMid: Map<string, number> = new Map();

  constructor(params: Partial<RangeTradingParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as RangeTradingParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateStochasticK(history: number[], period: number): number | null {
    if (history.length < period) return null;
    const slice = history.slice(-period);
    const highest = Math.max(...slice);
    const lowest = Math.min(...slice);
    if (highest === lowest) return 50;
    const close = history[history.length - 1];
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  private calculateRange(highs: number[], lows: number[], lookback: number): RangeData | null {
    if (highs.length < lookback || lows.length < lookback) return null;
    
    const highSlice = highs.slice(-lookback);
    const lowSlice = lows.slice(-lookback);
    
    const rangeHigh = Math.max(...highSlice);
    const rangeLow = Math.min(...lowSlice);
    const rangeMid = (rangeHigh + rangeLow) / 2;
    const rangeSize = rangeHigh - rangeLow;
    
    return { rangeHigh, rangeLow, rangeMid, rangeSize };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.highHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const highs = this.highHistory.get(bar.tokenId)!;
    const lows = this.lowHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    history.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    
    if (history.length > 200) history.shift();
    if (highs.length > 200) highs.shift();
    if (lows.length > 200) lows.shift();

    const k = this.calculateStochasticK(history, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 100) kVals.shift();
    }

    const rangeData = this.calculateRange(highs, lows, this.params.range_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      const targetMid = this.rangeMid.get(bar.tokenId);
      
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.close <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          this.rangeMid.delete(bar.tokenId);
          return;
        }

        if (targetMid !== undefined) {
          if (bar.close >= targetMid) {
            ctx.close(bar.tokenId);
            this.entryPrice.delete(bar.tokenId);
            this.entryBar.delete(bar.tokenId);
            this.rangeMid.delete(bar.tokenId);
            return;
          }
        }

        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          this.rangeMid.delete(bar.tokenId);
          return;
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95 && rangeData !== null) {
      const rangePosition = (bar.close - rangeData.rangeLow) / rangeData.rangeSize;
      
      if (kVals.length >= 2) {
        const prevK = kVals[kVals.length - 2];
        const currK = kVals[kVals.length - 1];

        const kCrossAboveOversold = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
        
        const priceNearBottom = rangePosition <= this.params.entry_threshold;

        if (kCrossAboveOversold && priceNearBottom) {
          const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
          const size = cash / bar.close;
          if (size > 0 && cash <= ctx.getCapital()) {
            const result = ctx.buy(bar.tokenId, size);
            if (result.success) {
              this.entryPrice.set(bar.tokenId, bar.close);
              this.entryBar.set(bar.tokenId, barNum);
              this.rangeMid.set(bar.tokenId, rangeData.rangeMid);
            }
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
