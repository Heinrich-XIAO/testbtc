import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StochBaseline03Params extends StrategyParams {
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  momentum_threshold: number;
  momentum_lookback: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StochBaseline03Params = {
  stoch_k_period: 14,
  stoch_oversold: 18,
  stoch_overbought: 82,
  momentum_threshold: 0.01,
  momentum_lookback: 3,
  stop_loss: 0.08,
  profit_target: 0.15,
  max_hold_bars: 28,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StochBaseline03Params> | null {
  const paramsPath = path.join(__dirname, 'strat_stoch_baseline_03.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StochBaseline03Strategy implements Strategy {
  params: StochBaseline03Params;
  private prices: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private stochK: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StochBaseline03Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StochBaseline03Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getStochasticK(highs: number[], lows: number[], closes: number[], period: number): number | null {
    if (highs.length < period || lows.length < period || closes.length < period) return null;
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    const currentClose = closes[closes.length - 1];
    
    if (highestHigh === lowestLow) return 50;
    
    return ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  }

  private getMomentum(closes: number[], lookback: number): number | null {
    if (closes.length <= lookback) return null;
    const currentClose = closes[closes.length - 1];
    const prevClose = closes[closes.length - 1 - lookback];
    if (prevClose === 0) return null;
    return (currentClose - prevClose) / prevClose;
  }

  private getSupportResistance(lows: number[], highs: number[], lookback: number): { support: number; resistance: number } | null {
    if (lows.length < lookback || highs.length < lookback) return null;
    return {
      support: Math.min(...lows.slice(-lookback)),
      resistance: Math.max(...highs.slice(-lookback)),
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.prices.has(bar.tokenId)) {
      this.prices.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.stochK.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const prices = this.prices.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const stochKList = this.stochK.get(bar.tokenId)!;
    
    prices.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    
    if (prices.length > 200) prices.shift();
    if (highs.length > 200) highs.shift();
    if (lows.length > 200) lows.shift();
    
    const barCount = this.barCount.get(bar.tokenId)! + 1;
    this.barCount.set(bar.tokenId, barCount);

    const stochK = this.getStochasticK(highs, lows, prices, this.params.stoch_k_period);
    if (stochK !== null) {
      stochKList.push(stochK);
      if (stochKList.length > 100) stochKList.shift();
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId) || bar.close;
      const entryBarNum = this.entryBar.get(bar.tokenId) || barCount;
      const barsHeld = barCount - entryBarNum;

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

      if (barsHeld >= this.params.max_hold_bars) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.entryBar.delete(bar.tokenId);
        return;
      }

      if (stochKList.length >= 1 && stochKList[stochKList.length - 1] >= this.params.stoch_overbought) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.entryBar.delete(bar.tokenId);
        return;
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (stochKList.length >= 2) {
        const prevK = stochKList[stochKList.length - 2];
        const currK = stochKList[stochKList.length - 1];
        
        const crossedAboveOversold = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;

        if (crossedAboveOversold) {
          const momentum = this.getMomentum(prices, this.params.momentum_lookback);
          
          if (momentum !== null && momentum > this.params.momentum_threshold) {
            const supRes = this.getSupportResistance(lows, highs, 36);
            
            if (supRes !== null && bar.close > supRes.support) {
              const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
              const size = cash / bar.close;
              if (size > 0 && cash <= ctx.getCapital()) {
                const result = ctx.buy(bar.tokenId, size);
                if (result.success) {
                  this.entryPrice.set(bar.tokenId, bar.close);
                  this.entryBar.set(bar.tokenId, barCount);
                }
              }
            }
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
