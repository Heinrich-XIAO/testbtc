import type { Strategy, BacktestContext, Bar, StrategyParams, OrderResult } from '../types';
import { SimpleMovingAverage, ATR } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface ATRBreakoutParams extends StrategyParams {
  atr_period: number;
  atr_multiplier: number;
  lookback: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: ATRBreakoutParams = {
  atr_period: 14,
  atr_multiplier: 2.0,
  lookback: 20,
  stop_loss: 0.05,
  risk_percent: 0.10,
};

function loadSavedParams(): Partial<ATRBreakoutParams> | null {
  const paramsPath = path.join(__dirname, 'atr_breakout.params.json');
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
  private atr: ATR;
  private highs: number[] = [];
  private lows: number[] = [];
  private buyPrice: Map<string, number> = new Map();

  constructor(params: Partial<ATRBreakoutParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    this.params = {
      atr_period: mergedParams.atr_period,
      atr_multiplier: mergedParams.atr_multiplier,
      lookback: mergedParams.lookback,
      stop_loss: mergedParams.stop_loss,
      risk_percent: mergedParams.risk_percent,
    };
    this.atr = new ATR(this.params.atr_period);
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`ATR Breakout Strategy initialized with params:`);
    console.log(`  ATR period: ${this.params.atr_period}`);
    console.log(`  ATR multiplier: ${this.params.atr_multiplier}`);
    console.log(`  Lookback: ${this.params.lookback}`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    this.atr.update(bar.high, bar.low, bar.close);
    this.highs.push(bar.high);
    this.lows.push(bar.low);

    if (this.highs.length > this.params.lookback) {
      this.highs.shift();
      this.lows.shift();
    }

    const position = ctx.getPosition(bar.tokenId);
    const atrValue = this.atr.get(0);

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

        if (atrValue !== undefined && this.highs.length >= this.params.lookback) {
          const recentHigh = Math.max(...this.highs);
          if (bar.close < recentHigh - atrValue * this.params.atr_multiplier) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] ATR trailing stop SELL for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
          }
        }
      }
    } else {
      if (atrValue !== undefined && this.highs.length >= this.params.lookback) {
        const recentHigh = Math.max(...this.highs);
        const breakoutLevel = recentHigh + atrValue * this.params.atr_multiplier;

        if (bar.close > breakoutLevel) {
          const feeBuffer = 0.995;
          const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
          const size = cash / bar.close;

          if (size > 0 && cash <= ctx.getCapital()) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] ATR breakout BUY for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, breakout: ${breakoutLevel.toFixed(4)}, size: ${size.toFixed(2)}`);

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
