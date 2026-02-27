import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter165DParams extends StrategyParams {
  atr_lookback: number;
  atr_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter165DParams = {
  atr_lookback: 14,
  atr_threshold: 0.01,
  stoch_oversold: 20,
  stop_loss: 0.08,
  profit_target: 0.15,
  max_hold_bars: 28,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter165DParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter165_d.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StratIter165DStrategy implements Strategy {
  params: StratIter165DParams;
  private priceHistory: Map<string, number[]> = new Map();
  private highHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private atrValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter165DParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter165DParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number | null {
    if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) return null;
    
    let trSum = 0;
    for (let i = 1; i <= period; i++) {
      const idx = highs.length - i;
      const high = highs[idx];
      const low = lows[idx];
      const prevClose = closes[idx - 1];
      
      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);
      
      trSum += Math.max(tr1, tr2, tr3);
    }
    
    return trSum / period;
  }

  private calculateStochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period || highs.length < period || lows.length < period) return null;
    
    const close = closes[closes.length - 1];
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    
    if (highest === lowest) return 50;
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.highHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.atrValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.priceHistory.get(bar.tokenId)!;
    const highs = this.highHistory.get(bar.tokenId)!;
    const lows = this.lowHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const atrVals = this.atrValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    
    if (closes.length > 200) closes.shift();
    if (highs.length > 200) highs.shift();
    if (lows.length > 200) lows.shift();

    const k = this.calculateStochasticK(closes, highs, lows, 14);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 100) kVals.shift();
    }

    const atr = this.calculateATR(highs, lows, closes, this.params.atr_lookback);
    if (atr !== null) {
      atrVals.push(atr);
      if (atrVals.length > 100) atrVals.shift();
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.close <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (bar.close >= entry * (1 + this.params.profit_target)) {
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
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (kVals.length >= 2 && atr !== null) {
        const prevK = kVals[kVals.length - 2];
        const currK = kVals[kVals.length - 1];

        const kCrossAboveOversold = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
        
        const atrAsPercent = atr / bar.close;
        const sufficientVolatility = atrAsPercent > this.params.atr_threshold;

        if (kCrossAboveOversold && sufficientVolatility) {
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
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
