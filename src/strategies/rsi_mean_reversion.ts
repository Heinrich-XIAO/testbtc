import type { Strategy, BacktestContext, Bar, StrategyParams, OrderResult } from '../types';
import { RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface RSIMeanReversionParams extends StrategyParams {
  rsi_period: number;
  rsi_oversold: number;
  rsi_overbought: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: RSIMeanReversionParams = {
  rsi_period: 14,
  rsi_oversold: 30,
  rsi_overbought: 70,
  stop_loss: 0.05,
  risk_percent: 0.10,
};

function loadSavedParams(): Partial<RSIMeanReversionParams> | null {
  const paramsPath = path.join(__dirname, 'rsi_mean_reversion.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<RSIMeanReversionParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof RSIMeanReversionParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class RSIMeanReversionStrategy implements Strategy {
  params: RSIMeanReversionParams;
  private rsi: RSI;
  private buyPrice: Map<string, number> = new Map();

  constructor(params: Partial<RSIMeanReversionParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    this.params = {
      rsi_period: mergedParams.rsi_period,
      rsi_oversold: mergedParams.rsi_oversold,
      rsi_overbought: mergedParams.rsi_overbought,
      stop_loss: mergedParams.stop_loss,
      risk_percent: mergedParams.risk_percent,
    };
    this.rsi = new RSI(this.params.rsi_period);
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`RSI Mean Reversion Strategy initialized with params:`);
    console.log(`  RSI period: ${this.params.rsi_period}`);
    console.log(`  Oversold: ${this.params.rsi_oversold}`);
    console.log(`  Overbought: ${this.params.rsi_overbought}`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    this.rsi.update(bar.close);

    const position = ctx.getPosition(bar.tokenId);
    const rsiValue = this.rsi.get(0);

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

        if (rsiValue !== undefined && rsiValue >= this.params.rsi_overbought) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] RSI overbought SELL for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, RSI: ${rsiValue.toFixed(2)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
        }
      }
    } else {
      if (rsiValue !== undefined && rsiValue <= this.params.rsi_oversold) {
        const feeBuffer = 0.995;
        const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
        const size = cash / bar.close;

        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] RSI oversold BUY for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, RSI: ${rsiValue.toFixed(2)}, size: ${size.toFixed(2)}`);

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
