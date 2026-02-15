import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * RSI Divergence + Stochastic Combo
 * Requires RSI divergence and stochastic signal within 3 bars
 */

export interface RsiStochCombo205StrategyParams extends StrategyParams {
  rsi_period: number;
  divergence_lookback: number;
  k_period: number;
  d_period: number;
  oversold: number;
  overbought: number;
  signal_window: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: RsiStochCombo205StrategyParams = {
  rsi_period: 14,
  divergence_lookback: 5,
  k_period: 14,
  d_period: 3,
  oversold: 20,
  overbought: 80,
  signal_window: 3,
  stop_loss: 0.05,
  risk_percent: 0.1,
};

function loadSavedParams(): Partial<RsiStochCombo205StrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_rsi_stoch_combo_205.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<RsiStochCombo205StrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof RsiStochCombo205StrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class RsiStochCombo205Strategy implements Strategy {
  params: RsiStochCombo205StrategyParams;
  private rsiMap: Map<string, RSI> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private rsiHistory: Map<string, number[]> = new Map();
  private stochPriceHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private divergenceSignalBar: Map<string, number> = new Map();
  private stochSignalBar: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();

  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<RsiStochCombo205StrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as RsiStochCombo205StrategyParams;
    this.params.rsi_period = Math.max(3, Math.floor(this.params.rsi_period));
    this.params.divergence_lookback = Math.max(3, Math.floor(this.params.divergence_lookback));
    this.params.k_period = Math.max(3, Math.floor(this.params.k_period));
    this.params.d_period = Math.max(2, Math.floor(this.params.d_period));
    this.params.signal_window = Math.max(1, Math.floor(this.params.signal_window));
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    const currentBarCount = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, currentBarCount);
    
    if (!this.rsiMap.has(bar.tokenId)) {
      this.rsiMap.set(bar.tokenId, new RSI(this.params.rsi_period));
      this.priceHistory.set(bar.tokenId, []);
      this.rsiHistory.set(bar.tokenId, []);
      this.stochPriceHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
    }
    
    const rsi = this.rsiMap.get(bar.tokenId)!;
    rsi.update(bar.close);
    const rsiVal = rsi.get(0);
    if (rsiVal === undefined) return;

    // Update RSI divergence history
    const prices = this.priceHistory.get(bar.tokenId)!;
    const rsis = this.rsiHistory.get(bar.tokenId)!;
    prices.push(bar.close);
    rsis.push(rsiVal);
    if (prices.length > this.params.divergence_lookback) {
      prices.shift();
      rsis.shift();
    }

    // Update Stochastic history
    const stochHistory = this.stochPriceHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    stochHistory.push(bar.close);
    if (stochHistory.length > this.params.k_period) {
      stochHistory.shift();
    }

    let k: number | undefined;
    let d: number | undefined;
    
    if (stochHistory.length >= this.params.k_period) {
      const highest = Math.max(...stochHistory);
      const lowest = Math.min(...stochHistory);
      k = highest === lowest ? 50 : ((bar.close - lowest) / (highest - lowest)) * 100;
      kVals.push(k);
      if (kVals.length > this.params.d_period) {
        kVals.shift();
      }
      if (kVals.length >= this.params.d_period) {
        d = kVals.reduce((a, b) => a + b, 0) / kVals.length;
      }
    }

    const position = ctx.getPosition(bar.tokenId);

    // Manage existing position
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        // Stop loss
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.divergenceSignalBar.delete(bar.tokenId);
          this.stochSignalBar.delete(bar.tokenId);
          return;
        }
        // Take profit at overbought
        if (rsiVal >= this.params.overbought || (k !== undefined && k >= this.params.overbought)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.divergenceSignalBar.delete(bar.tokenId);
          this.stochSignalBar.delete(bar.tokenId);
        }
      }
      return;
    }

    // Entry logic: both signals must occur within signal_window bars
    if (bar.close > 0.05 && bar.close < 0.95) {
      // Check for bearish RSI divergence: price makes higher high, RSI makes lower high
      // For shorts: high price with lower RSI indicates weakening momentum
      let bearishDiv = false;
      if (prices.length >= this.params.divergence_lookback) {
        const priceHigh = Math.max(...prices.slice(0, -1));
        const rsiHigh = Math.max(...rsis.slice(0, -1));
        bearishDiv = bar.close >= priceHigh && rsiVal < rsiHigh && rsiVal > this.params.overbought;
      }

      // Check for bullish RSI divergence: price makes lower low, RSI makes higher low
      // For longs: low price with higher RSI indicates strengthening momentum
      let bullishDiv = false;
      if (prices.length >= this.params.divergence_lookback) {
        const priceLow = Math.min(...prices.slice(0, -1));
        const rsiLow = Math.min(...rsis.slice(0, -1));
        bullishDiv = bar.close <= priceLow && rsiVal > rsiLow && rsiVal < this.params.oversold;
      }

      // Stochastic signals
      let stochOversold = false;
      let stochOverbought = false;
      if (k !== undefined && d !== undefined) {
        stochOversold = k <= this.params.oversold && k > d; // %K rising from oversold
        stochOverbought = k >= this.params.overbought && k < d; // %K falling from overbought
      }

      // Track signal bars
      const window = this.params.signal_window;
      
      // Track divergence signals
      if (bullishDiv) {
        this.divergenceSignalBar.set(bar.tokenId, currentBarCount);
      }
      if (stochOversold) {
        this.stochSignalBar.set(bar.tokenId, currentBarCount);
      }

      // Check for combo signal within window
      const divBar = this.divergenceSignalBar.get(bar.tokenId);
      const stochBar = this.stochSignalBar.get(bar.tokenId);
      
      const hasDivergenceSignal = divBar !== undefined && (currentBarCount - divBar) <= window;
      const hasStochSignal = stochBar !== undefined && (currentBarCount - stochBar) <= window;

      // Long entry: bullish divergence + stochastic oversold confirmation within window
      if (hasDivergenceSignal && hasStochSignal && bar.close > 0.05 && bar.close < 0.95) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.divergenceSignalBar.delete(bar.tokenId);
            this.stochSignalBar.delete(bar.tokenId);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
