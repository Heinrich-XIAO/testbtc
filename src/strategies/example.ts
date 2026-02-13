import type { Strategy, BacktestContext, Bar, StrategyParams, OrderResult } from '../types';
import { SimpleMovingAverage, CrossOver } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface SimpleMAStrategyParams extends StrategyParams {
  fast_period: number;
  slow_period: number;
  stop_loss: number;
  trailing_stop: boolean;
  risk_percent: number;
}

const defaultParams: SimpleMAStrategyParams = {
  fast_period: 50,
  slow_period: 200,
  stop_loss: 0.02,
  trailing_stop: false,
  risk_percent: 0.10,
};

function loadSavedParams(): Partial<SimpleMAStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'example.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<SimpleMAStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (key === 'trailing_stop' && typeof value === 'number') {
          params[key as keyof SimpleMAStrategyParams] = value === 1;
        } else if (typeof value === 'number') {
          params[key as keyof SimpleMAStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class SimpleMAStrategy implements Strategy {
  params: SimpleMAStrategyParams;
  private fastMA: SimpleMovingAverage;
  private slowMA: SimpleMovingAverage;
  private crossover: CrossOver;
  private buyPrice: Map<string, number> = new Map();

  constructor(params: Partial<SimpleMAStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    this.params = {
      fast_period: mergedParams.fast_period,
      slow_period: mergedParams.slow_period,
      stop_loss: mergedParams.stop_loss,
      trailing_stop: mergedParams.trailing_stop,
      risk_percent: mergedParams.risk_percent,
    };
    this.fastMA = new SimpleMovingAverage(this.params.fast_period);
    this.slowMA = new SimpleMovingAverage(this.params.slow_period);
    this.crossover = new CrossOver(this.fastMA, this.slowMA);
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`SimpleMAStrategy initialized with params:`);
    console.log(`  Fast MA period: ${this.params.fast_period}`);
    console.log(`  Slow MA period: ${this.params.slow_period}`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Trailing stop: ${this.params.trailing_stop}`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    this.fastMA.update(bar.close);
    this.slowMA.update(bar.close);
    this.crossover.update();

    const position = ctx.getPosition(bar.tokenId);
    const crossoverValue = this.crossover.get(0);

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

        if (this.params.trailing_stop && bar.close > buyPrice) {
          this.buyPrice.set(bar.tokenId, bar.close);
        }
      }

      if (crossoverValue !== undefined && crossoverValue < 0) {
        console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] MA crossover SELL signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
        ctx.close(bar.tokenId);
        this.buyPrice.delete(bar.tokenId);
      }
    } else {
      if (crossoverValue !== undefined && crossoverValue > 0) {
        // Account for 0.2% trading fee when sizing position
        // Use 99.5% of intended cash to ensure we have enough for fees
        const feeBuffer = 0.995;
        const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
        const size = cash / bar.close;

        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] MA crossover BUY signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, size: ${size.toFixed(2)}`);

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
