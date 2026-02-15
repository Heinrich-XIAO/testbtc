import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Range Trading Strategy for Prediction Markets
 * 
 * Designed for prediction markets where prices tend to move toward 0 or 1.
 * Buys when price is low and sells when price is higher.
 * 
 * Parameters:
 * - buy_below: Buy when price is below this level (0.1-0.4)
 * - sell_above: Sell when price is above this level (0.6-0.9)
 * - stop_loss: Fixed stop loss percentage
 * - risk_percent: Position size as % of capital
 */

export interface RangeTradingParams extends StrategyParams {
  buy_below: number;
  sell_above: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: RangeTradingParams = {
  buy_below: 0.3,
  sell_above: 0.6,
  stop_loss: 0.15,
  risk_percent: 0.1,
};

function loadSavedParams(): Partial<RangeTradingParams> | null {
  const paramsPath = path.join(__dirname, 'strat_range_08.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<RangeTradingParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof RangeTradingParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class RangeTradingStrategy implements Strategy {
  params: RangeTradingParams;
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<RangeTradingParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    // Ensure buy_below < sell_above
    let buyBelow = mergedParams.buy_below;
    let sellAbove = mergedParams.sell_above;
    if (buyBelow >= sellAbove) {
      // Swap if inverted
      [buyBelow, sellAbove] = [sellAbove, buyBelow];
    }

    this.params = {
      buy_below: buyBelow,
      sell_above: sellAbove,
      stop_loss: mergedParams.stop_loss,
      risk_percent: mergedParams.risk_percent,
    };
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`RangeTradingStrategy initialized:`);
    console.log(`  Buy below: ${(this.params.buy_below * 100).toFixed(0)}%`);
    console.log(`  Sell above: ${(this.params.sell_above * 100).toFixed(0)}%`);
    console.log(`  Stop loss: ${(this.params.stop_loss * 100).toFixed(1)}%`);
    console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      
      if (entry) {
        // Stop loss
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] STOP LOSS ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }

        // Take profit - sell when price goes above sell_above
        if (bar.close >= this.params.sell_above) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] TAKE PROFIT ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
      }
    } else {
      // Entry: buy when price is below buy_below threshold
      if (bar.close <= this.params.buy_below && bar.close > 0.02) {
        const cash = ctx.getCapital() * this.params.risk_percent;
        const size = cash / bar.close;

        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... price=${bar.close.toFixed(4)}`);
          
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {
    console.log('\nStrategy completed.');
  }
}
