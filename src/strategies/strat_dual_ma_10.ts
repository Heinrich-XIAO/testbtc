import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dual MA with Trend Filter Strategy
 *
 * Extends the basic MA crossover by adding a longer-term trend MA filter.
 * Only takes buy signals when the price is above the trend MA, preventing
 * entries during downtrends.
 *
 * Parameters:
 * - fast_period: Fast MA period (default 5)
 * - slow_period: Slow MA period (default 12)
 * - trend_period: Trend filter MA period (default 25)
 * - stop_loss: Fixed stop loss percentage (default 0.05)
 * - trailing_stop_pct: Trailing stop percentage from highest (default 0.03)
 * - risk_percent: Position size as % of capital (default 0.10)
 */

export interface DualMAParams extends StrategyParams {
  fast_period: number;
  slow_period: number;
  trend_period: number;
  stop_loss: number;
  trailing_stop_pct: number;
  risk_percent: number;
}

const defaultParams: DualMAParams = {
  fast_period: 5,
  slow_period: 12,
  trend_period: 25,
  stop_loss: 0.05,
  trailing_stop_pct: 0.03,
  risk_percent: 0.10,
};

function loadSavedParams(): Partial<DualMAParams> | null {
  const paramsPath = path.join(__dirname, 'strat_dual_ma_10.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<DualMAParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof DualMAParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class DualMAStrategy implements Strategy {
  params: DualMAParams;

  // Per-token indicators
  private fastMAs: Map<string, SimpleMovingAverage> = new Map();
  private slowMAs: Map<string, SimpleMovingAverage> = new Map();
  private trendMAs: Map<string, SimpleMovingAverage> = new Map();
  private crossovers: Map<string, CrossOver> = new Map();

  // Per-token position tracking
  private buyPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<DualMAParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    // Ensure fast < slow < trend
    let fast = mergedParams.fast_period;
    let slow = mergedParams.slow_period;
    let trend = mergedParams.trend_period;

    // Sort the three periods so fast < slow < trend
    const sorted = [fast, slow, trend].sort((a, b) => a - b);
    fast = sorted[0];
    slow = sorted[1];
    trend = sorted[2];

    this.params = {
      fast_period: fast,
      slow_period: slow,
      trend_period: trend,
      stop_loss: mergedParams.stop_loss,
      trailing_stop_pct: mergedParams.trailing_stop_pct,
      risk_percent: mergedParams.risk_percent,
    };
  }

  private getIndicators(tokenId: string): {
    fastMA: SimpleMovingAverage;
    slowMA: SimpleMovingAverage;
    trendMA: SimpleMovingAverage;
    crossover: CrossOver;
  } {
    if (!this.fastMAs.has(tokenId)) {
      const fastMA = new SimpleMovingAverage(this.params.fast_period);
      const slowMA = new SimpleMovingAverage(this.params.slow_period);
      const trendMA = new SimpleMovingAverage(this.params.trend_period);
      const crossover = new CrossOver(fastMA, slowMA);

      this.fastMAs.set(tokenId, fastMA);
      this.slowMAs.set(tokenId, slowMA);
      this.trendMAs.set(tokenId, trendMA);
      this.crossovers.set(tokenId, crossover);
    }

    return {
      fastMA: this.fastMAs.get(tokenId)!,
      slowMA: this.slowMAs.get(tokenId)!,
      trendMA: this.trendMAs.get(tokenId)!,
      crossover: this.crossovers.get(tokenId)!,
    };
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`DualMAStrategy initialized with params:`);
    console.log(`  Fast MA period: ${this.params.fast_period}`);
    console.log(`  Slow MA period: ${this.params.slow_period}`);
    console.log(`  Trend MA period: ${this.params.trend_period}`);
    console.log(`  Stop loss: ${(this.params.stop_loss * 100).toFixed(1)}%`);
    console.log(`  Trailing stop: ${(this.params.trailing_stop_pct * 100).toFixed(1)}%`);
    console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { fastMA, slowMA, trendMA, crossover } = this.getIndicators(bar.tokenId);

    // Update all indicators with current price
    fastMA.update(bar.close);
    slowMA.update(bar.close);
    trendMA.update(bar.close);
    crossover.update();

    const crossoverValue = crossover.get(0);
    const trendValue = trendMA.get(0);
    const position = ctx.getPosition(bar.tokenId);

    // --- Exit logic ---
    if (position && position.size > 0) {
      const entry = this.buyPrice.get(bar.tokenId);

      if (entry !== undefined) {
        // Fixed stop loss
        const stopPrice = entry * (1 - this.params.stop_loss);
        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] STOP LOSS ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} entry=${entry.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        // Trailing stop
        const prevHighest = this.highestPrice.get(bar.tokenId) ?? entry;
        const highest = Math.max(prevHighest, bar.close);
        this.highestPrice.set(bar.tokenId, highest);

        const drawdown = (highest - bar.close) / highest;
        if (drawdown >= this.params.trailing_stop_pct && bar.close > entry) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] TRAILING STOP ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} highest=${highest.toFixed(4)} drawdown=${(drawdown * 100).toFixed(1)}%`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        // Bearish crossover exit
        if (crossoverValue !== undefined && crossoverValue < 0) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] SELL crossover ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
      }

      return;
    }

    // --- Entry logic ---
    // Don't trade near extremes
    if (bar.close < 0.05 || bar.close > 0.95) {
      return;
    }

    // Buy on bullish crossover IF price is above trend MA (uptrend confirmed)
    if (crossoverValue !== undefined && crossoverValue > 0) {
      if (trendValue !== undefined && bar.close > trendValue) {
        const feeBuffer = 0.995;
        const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
        const size = cash / bar.close;

        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)} trendMA=${trendValue.toFixed(4)}`);

          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.buyPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          } else {
            console.error(`  Order failed: ${result.error}`);
          }
        }
      }
    }
  }

  onComplete(ctx: BacktestContext): void {
    console.log('\nStrategy completed.');
    const positions = ctx.portfolio.getAllPositions();
    if (positions.length > 0) {
      console.log(`Open positions: ${positions.length}`);
      for (const pos of positions) {
        console.log(`  ${pos.tokenId.slice(0, 8)}...: ${pos.size.toFixed(2)} @ ${pos.avgPrice.toFixed(4)}`);
      }
    }
  }
}
