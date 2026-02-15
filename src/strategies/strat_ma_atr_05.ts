import type { Strategy, BacktestContext, Bar, StrategyParams, OrderResult } from '../types';
import { SimpleMovingAverage, CrossOver } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface MAStrategyWithATRParams extends StrategyParams {
  fast_period: number;
  slow_period: number;
  volatility_period: number;
  vol_multiplier: number;
  risk_percent: number;
}

const defaultParams: MAStrategyWithATRParams = {
  fast_period: 5,
  slow_period: 15,
  volatility_period: 20,
  vol_multiplier: 2.0,
  risk_percent: 0.10,
};

function loadSavedParams(): Partial<MAStrategyWithATRParams> | null {
  const paramsPath = path.join(__dirname, 'strat_ma_atr_05.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<MAStrategyWithATRParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof MAStrategyWithATRParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

/**
 * Compute population standard deviation of an array of numbers.
 * Returns 0 if fewer than 2 values.
 */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0);
  return Math.sqrt(sqDiffs / values.length);
}

export class MAStrategyWithATRStop implements Strategy {
  params: MAStrategyWithATRParams;

  // Per-token indicators
  private fastMAs: Map<string, SimpleMovingAverage> = new Map();
  private slowMAs: Map<string, SimpleMovingAverage> = new Map();
  private crossovers: Map<string, CrossOver> = new Map();

  // Per-token price buffer for volatility (stddev) calculation
  private priceBuffers: Map<string, number[]> = new Map();

  // Per-token entry tracking
  private buyPrice: Map<string, number> = new Map();
  private buyVolatility: Map<string, number> = new Map();

  constructor(params: Partial<MAStrategyWithATRParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    this.params = {
      fast_period: mergedParams.fast_period,
      slow_period: mergedParams.slow_period,
      volatility_period: mergedParams.volatility_period,
      vol_multiplier: mergedParams.vol_multiplier,
      risk_percent: mergedParams.risk_percent,
    };
  }

  private getIndicators(tokenId: string): { fastMA: SimpleMovingAverage; slowMA: SimpleMovingAverage; crossover: CrossOver } {
    let fastMA = this.fastMAs.get(tokenId);
    let slowMA = this.slowMAs.get(tokenId);
    let crossover = this.crossovers.get(tokenId);

    if (!fastMA || !slowMA || !crossover) {
      fastMA = new SimpleMovingAverage(this.params.fast_period);
      slowMA = new SimpleMovingAverage(this.params.slow_period);
      crossover = new CrossOver(fastMA, slowMA);
      this.fastMAs.set(tokenId, fastMA);
      this.slowMAs.set(tokenId, slowMA);
      this.crossovers.set(tokenId, crossover);
    }

    return { fastMA, slowMA, crossover };
  }

  private updatePriceBuffer(tokenId: string, price: number): number[] {
    let buffer = this.priceBuffers.get(tokenId);
    if (!buffer) {
      buffer = [];
      this.priceBuffers.set(tokenId, buffer);
    }
    buffer.push(price);
    if (buffer.length > this.params.volatility_period) {
      buffer.shift();
    }
    return buffer;
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`MA + Volatility Stop Strategy initialized with params:`);
    console.log(`  Fast MA period: ${this.params.fast_period}`);
    console.log(`  Slow MA period: ${this.params.slow_period}`);
    console.log(`  Volatility period: ${this.params.volatility_period}`);
    console.log(`  Volatility multiplier: ${this.params.vol_multiplier}`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { fastMA, slowMA, crossover } = this.getIndicators(bar.tokenId);

    fastMA.update(bar.close);
    slowMA.update(bar.close);
    crossover.update();

    const priceBuffer = this.updatePriceBuffer(bar.tokenId, bar.close);
    const currentVol = stddev(priceBuffer);

    const position = ctx.getPosition(bar.tokenId);
    const crossoverValue = crossover.get(0);

    if (position && position.size > 0) {
      const entryPrice = this.buyPrice.get(bar.tokenId);
      const entryVol = this.buyVolatility.get(bar.tokenId);

      if (entryPrice !== undefined && entryVol !== undefined) {
        // Use the greater of entry-time volatility and current volatility
        // to avoid a zero stop when vol was zero at entry
        const effectiveVol = Math.max(entryVol, currentVol);

        // If volatility is still essentially zero, fall back to a fixed
        // percentage stop (2% of entry price) so positions aren't held forever
        const stopDistance = effectiveVol > 1e-9
          ? effectiveVol * this.params.vol_multiplier
          : entryPrice * 0.02;

        const stopPrice = entryPrice - stopDistance;

        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Volatility stop triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)} (stop: ${stopPrice.toFixed(4)})`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.buyVolatility.delete(bar.tokenId);
          return;
        }

        if (crossoverValue !== undefined && crossoverValue < 0) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] MA crossover SELL signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.buyVolatility.delete(bar.tokenId);
        }
      }
    } else {
      if (crossoverValue !== undefined && crossoverValue > 0) {
        const feeBuffer = 0.995;
        const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
        const size = cash / bar.close;

        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] MA crossover BUY signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, size: ${size.toFixed(2)}`);

          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.buyPrice.set(bar.tokenId, bar.close);
            this.buyVolatility.set(bar.tokenId, currentVol);
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
