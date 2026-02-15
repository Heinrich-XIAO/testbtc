import type { Strategy, BacktestContext, Bar, StrategyParams, OrderResult } from '../types';
import { RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface SupportResistanceParams extends StrategyParams {
  lookback: number;
  bounce_threshold: number;
  stop_loss: number;
  risk_percent: number;
  take_profit: number;
}

const defaultParams: SupportResistanceParams = {
  lookback: 10,
  bounce_threshold: 0.05,
  stop_loss: 0.05,
  risk_percent: 0.10,
  take_profit: 0.10,
};

function loadSavedParams(): Partial<SupportResistanceParams> | null {
  const paramsPath = path.join(__dirname, 'strat_support_06.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<SupportResistanceParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof SupportResistanceParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class SupportResistanceStrategy implements Strategy {
  params: SupportResistanceParams;
  private lows: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private prevClose: Map<string, number> = new Map();
  private buyPrice: Map<string, number> = new Map();

  constructor(params: Partial<SupportResistanceParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    this.params = {
      lookback: mergedParams.lookback,
      bounce_threshold: mergedParams.bounce_threshold,
      stop_loss: mergedParams.stop_loss,
      risk_percent: mergedParams.risk_percent,
      take_profit: mergedParams.take_profit,
    };
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`Support/Resistance Strategy initialized with params:`);
    console.log(`  Lookback: ${this.params.lookback}`);
    console.log(`  Bounce threshold: ${this.params.bounce_threshold * 100}%`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Take profit: ${this.params.take_profit * 100}%`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    let tokenLows = this.lows.get(bar.tokenId) || [];
    let tokenHighs = this.highs.get(bar.tokenId) || [];

    tokenLows.push(bar.low);
    tokenHighs.push(bar.high);

    if (tokenLows.length > this.params.lookback) {
      tokenLows.shift();
      tokenHighs.shift();
    }

    this.lows.set(bar.tokenId, tokenLows);
    this.highs.set(bar.tokenId, tokenHighs);

    const position = ctx.getPosition(bar.tokenId);
    const prev = this.prevClose.get(bar.tokenId);
    this.prevClose.set(bar.tokenId, bar.close);

    if (position && position.size > 0) {
      const buyPrice = this.buyPrice.get(bar.tokenId);
      if (buyPrice !== undefined) {
        // Stop loss
        const stopPrice = buyPrice * (1 - this.params.stop_loss);
        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          return;
        }

        // Take profit
        const targetPrice = buyPrice * (1 + this.params.take_profit);
        if (bar.close >= targetPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Take profit for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          return;
        }

        // Sell at resistance
        if (tokenHighs.length >= this.params.lookback) {
          const resistance = Math.max(...tokenHighs);
          if (bar.close >= resistance * (1 - this.params.bounce_threshold)) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Resistance SELL for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
          }
        }
      }
    } else {
      // Prediction market bounds: skip tokens priced too high or too low
      if (bar.close > 0.80 || bar.close < 0.05) {
        return;
      }

      if (tokenLows.length >= this.params.lookback && prev !== undefined) {
        const support = Math.min(...tokenLows);
        const bounceLevel = support * (1 + this.params.bounce_threshold);

        // Buy when price is near support (within bounce_threshold) AND trending up
        if (bar.close <= bounceLevel && bar.close > prev) {
          const feeBuffer = 0.995;
          const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
          const size = cash / bar.close;

          if (size > 0 && cash <= ctx.getCapital()) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Support bounce BUY for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, support: ${support.toFixed(4)}, size: ${size.toFixed(2)}`);

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
