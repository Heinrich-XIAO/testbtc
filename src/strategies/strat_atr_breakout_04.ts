import type { Strategy, BacktestContext, Bar, StrategyParams, OrderResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface ATRBreakoutParams extends StrategyParams {
  breakout_multiplier: number;
  lookback: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: ATRBreakoutParams = {
  breakout_multiplier: 0.5,
  lookback: 10,
  stop_loss: 0.05,
  risk_percent: 0.10,
};

function loadSavedParams(): Partial<ATRBreakoutParams> | null {
  const paramsPath = path.join(__dirname, 'strat_atr_breakout_04.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<ATRBreakoutParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof ATRBreakoutParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class ATRBreakoutStrategy implements Strategy {
  params: ATRBreakoutParams;
  private priceHistory: Map<string, number[]> = new Map();
  private buyPrice: Map<string, number> = new Map();

  constructor(params: Partial<ATRBreakoutParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    this.params = {
      breakout_multiplier: mergedParams.breakout_multiplier,
      lookback: mergedParams.lookback,
      stop_loss: mergedParams.stop_loss,
      risk_percent: mergedParams.risk_percent,
    };
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`ATR Breakout Strategy initialized with params:`);
    console.log(`  Breakout multiplier: ${this.params.breakout_multiplier}`);
    console.log(`  Lookback: ${this.params.lookback}`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    // Track price history per token
    let history = this.priceHistory.get(bar.tokenId);
    if (!history) {
      history = [];
      this.priceHistory.set(bar.tokenId, history);
    }
    history.push(bar.close);
    if (history.length > this.params.lookback) {
      history.shift();
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const buyPrice = this.buyPrice.get(bar.tokenId);
      if (buyPrice !== undefined) {
        const stopPrice = buyPrice * (1 - this.params.stop_loss);

        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          return;
        }

        // Trailing stop: sell if price drops below recent high by a fraction of the price range
        if (history.length >= this.params.lookback) {
          const recentHigh = Math.max(...history);
          const recentLow = Math.min(...history);
          const priceRange = recentHigh - recentLow;

          if (priceRange > 0 && bar.close < recentHigh - priceRange * this.params.breakout_multiplier) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Trailing stop SELL for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
          }
        }
      }
    } else {
      // Entry: buy when price breaks above recent high by a fraction of the price range
      if (history.length >= this.params.lookback) {
        // Use all but the current bar to define the range to break out of
        const lookbackPrices = history.slice(0, -1);
        const recentHigh = Math.max(...lookbackPrices);
        const recentLow = Math.min(...lookbackPrices);
        const priceRange = recentHigh - recentLow;

        if (priceRange > 0) {
          const breakoutLevel = recentHigh + priceRange * this.params.breakout_multiplier;

          if (bar.close > breakoutLevel) {
            const feeBuffer = 0.995;
            const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
            const size = cash / bar.close;

            if (size > 0 && cash <= ctx.getCapital()) {
              console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Breakout BUY for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, breakout: ${breakoutLevel.toFixed(4)}, range: ${priceRange.toFixed(4)}, size: ${size.toFixed(2)}`);

              const result = ctx.buy(bar.tokenId, size);
              if (result.success) {
                this.buyPrice.set(bar.tokenId, bar.close);
              } else {
                console.error(`  Order failed: ${result.error}`);
              }
            }
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
