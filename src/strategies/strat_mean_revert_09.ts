import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Price Mean Reversion Strategy for Prediction Markets
 *
 * Computes a per-token moving average. When price deviates below the MA
 * by more than a threshold, buys (price is "cheap"). Sells when price
 * reverts back to or above the MA, or on stop loss.
 *
 * Parameters:
 * - ma_period: SMA period (default 8, short for limited history)
 * - deviation_threshold: minimum deviation below MA to trigger buy (default 0.03)
 * - stop_loss: fixed stop loss percentage (default 0.08)
 * - risk_percent: position size as % of capital (default 0.10)
 */

export interface MeanReversionParams extends StrategyParams {
  ma_period: number;
  deviation_threshold: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: MeanReversionParams = {
  ma_period: 8,
  deviation_threshold: 0.03,
  stop_loss: 0.08,
  risk_percent: 0.10,
};

function loadSavedParams(): Partial<MeanReversionParams> | null {
  const paramsPath = path.join(__dirname, 'strat_mean_revert_09.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<MeanReversionParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof MeanReversionParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class MeanReversionStrategy implements Strategy {
  params: MeanReversionParams;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<MeanReversionParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    this.params = {
      ma_period: Math.max(2, Math.floor(mergedParams.ma_period)),
      deviation_threshold: mergedParams.deviation_threshold,
      stop_loss: mergedParams.stop_loss,
      risk_percent: mergedParams.risk_percent,
    };
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`MeanReversionStrategy initialized:`);
    console.log(`  MA period: ${this.params.ma_period}`);
    console.log(`  Deviation threshold: ${(this.params.deviation_threshold * 100).toFixed(1)}%`);
    console.log(`  Stop loss: ${(this.params.stop_loss * 100).toFixed(1)}%`);
    console.log(`  Risk percent: ${(this.params.risk_percent * 100).toFixed(1)}%`);
  }

  private getSMA(tokenId: string): SimpleMovingAverage {
    let sma = this.smaMap.get(tokenId);
    if (!sma) {
      sma = new SimpleMovingAverage(this.params.ma_period);
      this.smaMap.set(tokenId, sma);
    }
    return sma;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const sma = this.getSMA(bar.tokenId);
    sma.update(bar.close);

    const maValue = sma.get(0);
    if (maValue === undefined) {
      return;
    }

    const price = bar.close;
    const deviation = maValue - price; // positive when price is below MA
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);

      if (entry) {
        // Stop loss
        if (price < entry * (1 - this.params.stop_loss)) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] STOP LOSS ${bar.tokenId.slice(0, 8)}... price=${price.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }

        // Mean reversion exit: price returned to or exceeded the MA
        if (price >= maValue) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] MEAN REVERT EXIT ${bar.tokenId.slice(0, 8)}... price=${price.toFixed(4)} ma=${maValue.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
      }
    } else {
      // Entry: buy when price deviates below MA by more than threshold
      if (deviation >= this.params.deviation_threshold) {
        // Don't buy near extremes (prediction market specific)
        if (price >= 0.05 && price <= 0.90) {
          const cash = ctx.getCapital() * this.params.risk_percent;
          const size = cash / price;

          if (size > 0 && cash <= ctx.getCapital()) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY ${bar.tokenId.slice(0, 8)}... price=${price.toFixed(4)} ma=${maValue.toFixed(4)} dev=${(deviation * 100).toFixed(1)}%`);

            const result = ctx.buy(bar.tokenId, size);
            if (result.success) {
              this.entryPrice.set(bar.tokenId, price);
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
