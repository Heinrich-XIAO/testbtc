import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter166DParams extends StrategyParams {
  top_n_markets: number;
  volume_lookback: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  support_lookback: number;
}

const defaultParams: StratIter166DParams = {
  top_n_markets: 100,
  volume_lookback: 30,
  stoch_oversold: 18,
  stop_loss: 0.08,
  profit_target: 0.15,
  max_hold_bars: 28,
  risk_percent: 0.25,
  support_lookback: 50,
};

function loadSavedParams(): Partial<StratIter166DParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter166_d.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StratIter166DStrategy implements Strategy {
  params: StratIter166DParams;
  private priceHistory: Map<string, number[]> = new Map();
  private highHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private volumeProxies: Map<string, number[]> = new Map();
  private avgVolume: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter166DParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter166DParams;
  }

  onInit(_ctx: BacktestContext): void {}

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

  private calculateVolumeProxy(high: number, low: number, close: number, prevClose: number): number {
    const range = high - low;
    const priceChange = Math.abs(close - prevClose);
    return Math.max(range, priceChange) * close;
  }

  private findSupportLevel(prices: number[], lookback: number): number | null {
    if (prices.length < lookback) return null;
    const slice = prices.slice(-lookback);
    return Math.min(...slice);
  }

  private isNearSupport(price: number, support: number, tolerance: number = 0.02): boolean {
    return price <= support * (1 + tolerance);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.highHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.volumeProxies.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.priceHistory.get(bar.tokenId)!;
    const highs = this.highHistory.get(bar.tokenId)!;
    const lows = this.lowHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const volProxies = this.volumeProxies.get(bar.tokenId)!;
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

    if (closes.length >= 2) {
      const volProxy = this.calculateVolumeProxy(bar.high, bar.low, bar.close, closes[closes.length - 2]);
      volProxies.push(volProxy);
      if (volProxies.length > 100) volProxies.shift();
      
      if (volProxies.length >= this.params.volume_lookback) {
        const avg = volProxies.slice(-this.params.volume_lookback).reduce((a, b) => a + b, 0) / this.params.volume_lookback;
        this.avgVolume.set(bar.tokenId, avg);
      }
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
      const marketVolumes = new Map<string, number>();
      for (const [tokenId, vol] of this.avgVolume.entries()) {
        marketVolumes.set(tokenId, vol);
      }
      
      const sortedMarkets = Array.from(marketVolumes.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([tokenId]) => tokenId);
      
      const isTopMarket = sortedMarkets.slice(0, this.params.top_n_markets).includes(bar.tokenId);
      
      if (!isTopMarket) return;
      
      if (kVals.length >= 2 && closes.length >= this.params.support_lookback) {
        const prevK = kVals[kVals.length - 2];
        const currK = kVals[kVals.length - 1];

        const kCrossAboveOversold = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
        
        const support = this.findSupportLevel(closes, this.params.support_lookback);
        const nearSupport = support !== null && this.isNearSupport(bar.close, support);

        if (kCrossAboveOversold && nearSupport) {
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
