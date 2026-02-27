import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter165CParams extends StrategyParams {
  stoch_k_period: number;
  stoch_oversold: number;
  confirmation_bars: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter165CParams = {
  stoch_k_period: 14,
  stoch_oversold: 20,
  confirmation_bars: 3,
  stop_loss: 0.08,
  profit_target: 0.15,
  max_hold_bars: 30,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter165CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter165_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StratIter165CStrategy implements Strategy {
  params: StratIter165CParams;
  private priceHistory: Map<string, number[]> = new Map();
  private highHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();
  private stochOversoldTriggered: Map<string, boolean> = new Map();
  private consecutiveBullishCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter165CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter165CParams;
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

  private isBullishBar(highs: number[], lows: number[], closes: number[], index: number): boolean {
    if (index < 1) return false;
    const prevHigh = highs[index - 1];
    const prevLow = lows[index - 1];
    const currHigh = highs[index];
    const currLow = lows[index];
    const currClose = closes[index];
    
    // Bullish bar: higher high, higher low, and close > open (implied by price action)
    const higherHigh = currHigh > prevHigh;
    const higherLow = currLow > prevLow;
    const closedHigher = currClose > closes[index - 1];
    
    return higherHigh && higherLow && closedHigher;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.highHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
      this.stochOversoldTriggered.set(bar.tokenId, false);
      this.consecutiveBullishCount.set(bar.tokenId, 0);
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
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (kVals.length >= 2) {
        const prevK = kVals[kVals.length - 2];
        const currK = kVals[kVals.length - 1];

        // Track when stochastic crosses above oversold threshold
        const kCrossAboveOversold = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
        
        if (kCrossAboveOversold) {
          this.stochOversoldTriggered.set(bar.tokenId, true);
          this.consecutiveBullishCount.set(bar.tokenId, 0);
        }

        // Check for consecutive bullish bars after stochastic trigger
        const stochTriggered = this.stochOversoldTriggered.get(bar.tokenId) || false;
        
        if (stochTriggered && highs.length >= 2) {
          const isBullish = this.isBullishBar(highs, lows, history, highs.length - 1);
          
          let count = this.consecutiveBullishCount.get(bar.tokenId) || 0;
          
          if (isBullish) {
            count++;
            this.consecutiveBullishCount.set(bar.tokenId, count);
          } else {
            // Reset if we get a non-bullish bar
            this.stochOversoldTriggered.set(bar.tokenId, false);
            this.consecutiveBullishCount.set(bar.tokenId, 0);
          }
          
          // Enter after required number of consecutive bullish bars
          if (count >= this.params.confirmation_bars) {
            const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
            const size = cash / bar.close;
            if (size > 0 && cash <= ctx.getCapital()) {
              const result = ctx.buy(bar.tokenId, size);
              if (result.success) {
                this.entryPrice.set(bar.tokenId, bar.close);
                this.entryBar.set(bar.tokenId, barNum);
                // Reset trigger after entry
                this.stochOversoldTriggered.set(bar.tokenId, false);
                this.consecutiveBullishCount.set(bar.tokenId, 0);
              }
            }
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
