import type { Strategy, BacktestContext, Bar, StrategyParams, OrderResult } from '../types';
import { SimpleMovingAverage, RSI, ATR, CrossOver } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface MAStrategyWithATRParams extends StrategyParams {
  fast_period: number;
  slow_period: number;
  atr_period: number;
  atr_multiplier: number;
  risk_percent: number;
}

const defaultParams: MAStrategyWithATRParams = {
  fast_period: 10,
  slow_period: 50,
  atr_period: 14,
  atr_multiplier: 2.0,
  risk_percent: 0.10,
};

function loadSavedParams(): Partial<MAStrategyWithATRParams> | null {
  const paramsPath = path.join(__dirname, 'ma_with_atr_stop.params.json');
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

export class MAStrategyWithATRStop implements Strategy {
  params: MAStrategyWithATRParams;
  private fastMA: SimpleMovingAverage;
  private slowMA: SimpleMovingAverage;
  private atr: ATR;
  private crossover: CrossOver;
  private buyPrice: Map<string, number> = new Map();
  private buyATR: Map<string, number> = new Map();

  constructor(params: Partial<MAStrategyWithATRParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    this.params = {
      fast_period: mergedParams.fast_period,
      slow_period: mergedParams.slow_period,
      atr_period: mergedParams.atr_period,
      atr_multiplier: mergedParams.atr_multiplier,
      risk_percent: mergedParams.risk_percent,
    };
    this.fastMA = new SimpleMovingAverage(this.params.fast_period);
    this.slowMA = new SimpleMovingAverage(this.params.slow_period);
    this.atr = new ATR(this.params.atr_period);
    this.crossover = new CrossOver(this.fastMA, this.slowMA);
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`MA + ATR Stop Strategy initialized with params:`);
    console.log(`  Fast MA period: ${this.params.fast_period}`);
    console.log(`  Slow MA period: ${this.params.slow_period}`);
    console.log(`  ATR period: ${this.params.atr_period}`);
    console.log(`  ATR multiplier: ${this.params.atr_multiplier}`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    this.fastMA.update(bar.close);
    this.slowMA.update(bar.close);
    this.atr.update(bar.high, bar.low, bar.close);
    this.crossover.update();

    const position = ctx.getPosition(bar.tokenId);
    const crossoverValue = this.crossover.get(0);
    const atrValue = this.atr.get(0);

    if (position && position.size > 0) {
      const buyPrice = this.buyPrice.get(bar.tokenId);
      const buyATR = this.buyATR.get(bar.tokenId);
      
      if (buyPrice !== undefined && atrValue !== undefined && buyATR !== undefined) {
        const atrStop = buyPrice - buyATR * this.params.atr_multiplier;

        if (bar.close <= atrStop) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] ATR stop triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)} (ATR stop: ${atrStop.toFixed(4)})`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.buyATR.delete(bar.tokenId);
          return;
        }

        if (crossoverValue !== undefined && crossoverValue < 0) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] MA crossover SELL signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.buyATR.delete(bar.tokenId);
        }
      }
    } else {
      if (crossoverValue !== undefined && crossoverValue > 0 && atrValue !== undefined) {
        const feeBuffer = 0.995;
        const cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;
        const size = cash / bar.close;

        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] MA crossover BUY signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, size: ${size.toFixed(2)}`);

          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.buyPrice.set(bar.tokenId, bar.close);
            this.buyATR.set(bar.tokenId, atrValue);
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
