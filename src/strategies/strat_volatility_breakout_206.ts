import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { ATR } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Volatility Breakout Strategy based on ATR
 * 
 * Logic:
 * 1) Calculate ATR over lookback period
 * 2) Enter long when price breaks above (high + atr_multiplier * ATR)
 * 3) Enter short when price breaks below (low - atr_multiplier * ATR)
 * 4) Use volume confirmation (volume > average)
 * 5) Per-token Maps for all state
 */

export interface VolatilityBreakoutParams extends StrategyParams {
  atr_period: number;
  atr_multiplier: number;
  lookback: number;
  volume_period: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: VolatilityBreakoutParams = {
  atr_period: 14,
  atr_multiplier: 0.5,
  lookback: 20,
  volume_period: 10,
  stop_loss: 0.04,
  trailing_stop: 0.03,
  risk_percent: 0.10,
};

function loadSavedParams(): Partial<VolatilityBreakoutParams> | null {
  const paramsPath = path.join(__dirname, 'strat_volatility_breakout_206.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<VolatilityBreakoutParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof VolatilityBreakoutParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class VolatilityBreakoutStrategy implements Strategy {
  params: VolatilityBreakoutParams;
  
  // Per-token state using Maps
  private atrIndicators: Map<string, ATR> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private highHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private volumeHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();
  private lowestPrice: Map<string, number> = new Map();
  private positionSide: Map<string, 'long' | 'short'> = new Map();

  constructor(params: Partial<VolatilityBreakoutParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    this.params = {
      atr_period: Math.max(2, Math.floor(mergedParams.atr_period)),
      atr_multiplier: mergedParams.atr_multiplier,
      lookback: Math.max(2, Math.floor(mergedParams.lookback)),
      volume_period: Math.max(2, Math.floor(mergedParams.volume_period)),
      stop_loss: mergedParams.stop_loss,
      trailing_stop: mergedParams.trailing_stop,
      risk_percent: mergedParams.risk_percent,
    };
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`Volatility Breakout Strategy initialized with params:`);
    console.log(`  ATR Period: ${this.params.atr_period}`);
    console.log(`  ATR Multiplier: ${this.params.atr_multiplier}`);
    console.log(`  Lookback: ${this.params.lookback}`);
    console.log(`  Volume Period: ${this.params.volume_period}`);
    console.log(`  Stop Loss: ${(this.params.stop_loss * 100).toFixed(2)}%`);
    console.log(`  Trailing Stop: ${(this.params.trailing_stop * 100).toFixed(2)}%`);
    console.log(`  Risk Percent: ${(this.params.risk_percent * 100).toFixed(2)}%`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    // Initialize per-token state if not exists
    if (!this.atrIndicators.has(bar.tokenId)) {
      this.atrIndicators.set(bar.tokenId, new ATR(this.params.atr_period));
      this.priceHistory.set(bar.tokenId, []);
      this.highHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.volumeHistory.set(bar.tokenId, []);
    }

    const atrIndicator = this.atrIndicators.get(bar.tokenId)!;
    const priceHist = this.priceHistory.get(bar.tokenId)!;
    const highHist = this.highHistory.get(bar.tokenId)!;
    const lowHist = this.lowHistory.get(bar.tokenId)!;
    const volumeHist = this.volumeHistory.get(bar.tokenId)!;

    // Update ATR indicator
    atrIndicator.update(bar.high, bar.low, bar.close);
    const atr = atrIndicator.get(0);

    // Update price histories
    priceHist.push(bar.close);
    highHist.push(bar.high);
    lowHist.push(bar.low);

    // Calculate price movement as volume proxy (since Bar doesn't have volume)
    // In real implementation, replace with actual volume: bar.volume
    const priceRange = bar.high - bar.low;
    const volumeProxy = priceRange > 0 ? priceRange : 0;
    volumeHist.push(volumeProxy);

    // Maintain lookback window
    if (priceHist.length > this.params.lookback) {
      priceHist.shift();
      highHist.shift();
      lowHist.shift();
    }
    if (volumeHist.length > this.params.volume_period) {
      volumeHist.shift();
    }

    // Need enough data
    if (priceHist.length < this.params.lookback || atr === undefined) {
      return;
    }

    // Volume confirmation: current volume > average volume
    const avgVolume = volumeHist.length > 0 
      ? volumeHist.reduce((a, b) => a + b, 0) / volumeHist.length 
      : 0;
    const volumeConfirmed = volumeProxy > avgVolume;

    // Calculate breakout levels based on recent high/low
    const recentHigh = Math.max(...highHist.slice(0, -1));
    const recentLow = Math.min(...lowHist.slice(0, -1));

    const longBreakoutLevel = recentHigh + this.params.atr_multiplier * atr;
    const shortBreakoutLevel = recentLow - this.params.atr_multiplier * atr;

    const position = ctx.getPosition(bar.tokenId);

    // Handle existing position
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const side = this.positionSide.get(bar.tokenId);

      if (entry !== undefined && side !== undefined) {
        // Stop loss
        if (side === 'long' && bar.close < entry * (1 - this.params.stop_loss)) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss (long) for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.clearPositionState(bar.tokenId);
          return;
        }

        if (side === 'short' && bar.close > entry * (1 + this.params.stop_loss)) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss (short) for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.clearPositionState(bar.tokenId);
          return;
        }

        // Trailing stop for long
        if (side === 'long') {
          const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
          this.highestPrice.set(bar.tokenId, highest);
          
          if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Trailing stop (long) for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.clearPositionState(bar.tokenId);
            return;
          }
        }

        // Trailing stop for short
        if (side === 'short') {
          const lowest = Math.min(this.lowestPrice.get(bar.tokenId) ?? entry, bar.close);
          this.lowestPrice.set(bar.tokenId, lowest);
          
          if (bar.close > lowest * (1 + this.params.trailing_stop) && bar.close < entry) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Trailing stop (short) for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.clearPositionState(bar.tokenId);
            return;
          }
        }

        // Exit on opposite breakout signal
        if (side === 'long' && bar.close < shortBreakoutLevel && volumeConfirmed) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Exit long (opposite signal) for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.clearPositionState(bar.tokenId);
          return;
        }

        if (side === 'short' && bar.close > longBreakoutLevel && volumeConfirmed) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Exit short (opposite signal) for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.clearPositionState(bar.tokenId);
          return;
        }
      }
    } else {
      // No position - look for entry signals
      // Only enter if we have volume confirmation
      if (!volumeConfirmed) {
        return;
      }

      const feeBuffer = 0.995;
      const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;

      // Long entry: price breaks above (high + atr_multiplier * ATR)
      if (bar.close > longBreakoutLevel) {
        const size = cash / bar.close;

        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Long breakout for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, level: ${longBreakoutLevel.toFixed(4)}, ATR: ${atr.toFixed(4)}`);

          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
            this.positionSide.set(bar.tokenId, 'long');
          } else {
            console.error(`  Order failed: ${result.error}`);
          }
        }
        return;
      }

      // Short entry: price breaks below (low - atr_multiplier * ATR)
      if (bar.close < shortBreakoutLevel) {
        const size = cash / bar.close;

        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Short breakout for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, level: ${shortBreakoutLevel.toFixed(4)}, ATR: ${atr.toFixed(4)}`);

          const result = ctx.sell(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.lowestPrice.set(bar.tokenId, bar.close);
            this.positionSide.set(bar.tokenId, 'short');
          } else {
            console.error(`  Order failed: ${result.error}`);
          }
        }
      }
    }
  }

  private clearPositionState(tokenId: string): void {
    this.entryPrice.delete(tokenId);
    this.highestPrice.delete(tokenId);
    this.lowestPrice.delete(tokenId);
    this.positionSide.delete(tokenId);
  }

  onComplete(ctx: BacktestContext): void {
    console.log('\nStrategy completed.');
    const positions = ctx.portfolio.getAllPositions();
    if (positions.length > 0) {
      console.log(`Open positions: ${positions.length}`);
      for (const pos of positions) {
        const side = this.positionSide.get(pos.tokenId) ?? 'long';
        console.log(`  ${pos.tokenId.slice(0, 8)}...: ${side} ${pos.size.toFixed(2)} @ ${pos.avgPrice.toFixed(4)}`);
      }
    }
  }
}
