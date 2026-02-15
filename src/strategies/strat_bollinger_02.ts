import type { Strategy, BacktestContext, Bar, StrategyParams, OrderResult } from '../types';
import { SimpleMovingAverage, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface BollingerBandsStrategyParams extends StrategyParams {
  period: number;
  std_dev_multiplier: number;
  stop_loss: number;
  trailing_stop: boolean;
  risk_percent: number;
  mean_reversion: boolean;
  take_profit: number;
  take_profit_enabled: boolean;
  rsi_period: number;
  rsi_enabled: boolean;
  rsi_oversold: number;
  rsi_overbought: number;
  breakout_enabled: boolean;
  breakout_threshold: number;
}

const defaultParams: BollingerBandsStrategyParams = {
  period: 10,
  std_dev_multiplier: 2.0,
  stop_loss: 0.03,
  trailing_stop: true,
  risk_percent: 0.15,
  mean_reversion: true,
  take_profit: 0.05,
  take_profit_enabled: false,
  rsi_period: 14,
  rsi_enabled: false,
  rsi_oversold: 30,
  rsi_overbought: 70,
  breakout_enabled: false,
  breakout_threshold: 0.02,
};

function loadSavedParams(): Partial<BollingerBandsStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_bollinger_02.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<BollingerBandsStrategyParams> = {};

    const booleanParams = ['trailing_stop', 'mean_reversion', 'take_profit_enabled', 'rsi_enabled', 'breakout_enabled'];

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (booleanParams.includes(key)) {
          if (typeof value === 'number') {
            params[key as keyof BollingerBandsStrategyParams] = value === 1;
          } else if (typeof value === 'boolean') {
            params[key as keyof BollingerBandsStrategyParams] = value;
          }
        } else if (typeof value === 'number') {
          params[key as keyof BollingerBandsStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

class StandardDeviation {
  private prices: number[] = [];
  private period: number;
  
  constructor(period: number) {
    this.period = period;
  }
  
  update(price: number): void {
    this.prices.push(price);
    if (this.prices.length > this.period) {
      this.prices.shift();
    }
  }
  
  get(): number | undefined {
    if (this.prices.length < this.period) return undefined;
    
    const mean = this.prices.reduce((a, b) => a + b, 0) / this.prices.length;
    const squaredDiffs = this.prices.map(p => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / this.prices.length;
    return Math.sqrt(variance);
  }
  
  getValues(): number[] {
    return [...this.prices];
  }
}

interface TokenIndicators {
  sma: SimpleMovingAverage;
  stdDev: StandardDeviation;
  rsi: RSI;
  prices: number[];
}

export class BollingerBandsStrategy implements Strategy {
  params: BollingerBandsStrategyParams;
  private indicators: Map<string, TokenIndicators> = new Map();
  private buyPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<BollingerBandsStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    this.params = {
      period: mergedParams.period,
      std_dev_multiplier: mergedParams.std_dev_multiplier,
      stop_loss: mergedParams.stop_loss,
      trailing_stop: mergedParams.trailing_stop,
      risk_percent: mergedParams.risk_percent,
      mean_reversion: mergedParams.mean_reversion,
      take_profit: mergedParams.take_profit,
      take_profit_enabled: mergedParams.take_profit_enabled,
      rsi_period: mergedParams.rsi_period,
      rsi_enabled: mergedParams.rsi_enabled,
      rsi_oversold: mergedParams.rsi_oversold,
      rsi_overbought: mergedParams.rsi_overbought,
      breakout_enabled: mergedParams.breakout_enabled,
      breakout_threshold: mergedParams.breakout_threshold,
    };
  }

  private getIndicators(tokenId: string): TokenIndicators {
    let ind = this.indicators.get(tokenId);
    if (!ind) {
      ind = {
        sma: new SimpleMovingAverage(this.params.period),
        stdDev: new StandardDeviation(this.params.period),
        rsi: new RSI(this.params.rsi_period),
        prices: [],
      };
      this.indicators.set(tokenId, ind);
    }
    return ind;
  }

  private getBollingerBands(tokenId: string): { middle: number | undefined; upper: number | undefined; lower: number | undefined } {
    const ind = this.getIndicators(tokenId);
    const middle = ind.sma.get(0);
    const stdDev = ind.stdDev.get();
    
    if (middle === undefined || stdDev === undefined) {
      return { middle: undefined, upper: undefined, lower: undefined };
    }
    
    return {
      middle,
      upper: middle + (this.params.std_dev_multiplier * stdDev),
      lower: middle - (this.params.std_dev_multiplier * stdDev),
    };
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`BollingerBandsStrategy initialized with params:`);
    console.log(`  Period: ${this.params.period}`);
    console.log(`  Std Dev Multiplier: ${this.params.std_dev_multiplier}`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Trailing stop: ${this.params.trailing_stop}`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
    console.log(`  Mean reversion mode: ${this.params.mean_reversion}`);
    console.log(`  Take profit: ${this.params.take_profit_enabled ? `${this.params.take_profit * 100}%` : 'disabled'}`);
    console.log(`  RSI: ${this.params.rsi_enabled ? `period=${this.params.rsi_period}, oversold=${this.params.rsi_oversold}, overbought=${this.params.rsi_overbought}` : 'disabled'}`);
    console.log(`  Breakout: ${this.params.breakout_enabled ? `threshold=${this.params.breakout_threshold * 100}%` : 'disabled'}`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const ind = this.getIndicators(bar.tokenId);
    ind.sma.update(bar.close);
    ind.stdDev.update(bar.close);
    ind.rsi.update(bar.close);
    ind.prices.push(bar.close);
    
    if (ind.prices.length > this.params.period) {
      ind.prices.shift();
    }

    const position = ctx.getPosition(bar.tokenId);
    const bands = this.getBollingerBands(bar.tokenId);
    const rsiValue = ind.rsi.get(0);

    if (position && position.size > 0) {
      const buyPrice = this.buyPrice.get(bar.tokenId);
      const highest = this.highestPrice.get(bar.tokenId);
      
      if (buyPrice !== undefined) {
        const stopPrice = buyPrice * (1 - this.params.stop_loss);

        if (bar.close <= stopPrice) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        if (this.params.trailing_stop) {
          const currentHighest = highest !== undefined ? Math.max(highest, bar.close) : bar.close;
          this.highestPrice.set(bar.tokenId, currentHighest);
          
          const trailingStopPrice = currentHighest * (1 - this.params.stop_loss);
          if (bar.close <= trailingStopPrice && bar.close > buyPrice) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Trailing stop triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
            return;
          }
        }

        if (this.params.take_profit_enabled && bands.upper !== undefined) {
          const tpPrice = buyPrice * (1 + this.params.take_profit);
          if (bar.close >= tpPrice || bar.close >= bands.upper) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Take profit triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
            return;
          }
        }

        if (bands.upper !== undefined && this.params.mean_reversion) {
          let shouldSell = bar.close >= bands.upper;
          
          if (this.params.rsi_enabled && rsiValue !== undefined) {
            shouldSell = shouldSell && rsiValue >= this.params.rsi_overbought;
          }
          
          if (shouldSell) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Bollinger Bands SELL signal (price at upper band) for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}${rsiValue !== undefined ? `, RSI: ${rsiValue.toFixed(2)}` : ''}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
          }
        }
      }
    } else {
      let shouldBuy = false;
      let buyReason = '';

      if (this.params.breakout_enabled && bands.upper !== undefined) {
        const breakoutPrice = bands.upper * (1 + this.params.breakout_threshold);
        if (bar.close >= breakoutPrice) {
          shouldBuy = true;
          buyReason = `breakout above upper band`;
        }
      }

      if (!shouldBuy && this.params.mean_reversion && bands.lower !== undefined && bands.upper !== undefined) {
        if (bar.close <= bands.lower) {
          shouldBuy = true;
          buyReason = `price at lower band`;
        }
      }

      if (shouldBuy && this.params.rsi_enabled && rsiValue !== undefined) {
        shouldBuy = rsiValue <= this.params.rsi_oversold;
        if (shouldBuy) {
          buyReason += `, RSI oversold (${rsiValue.toFixed(2)})`;
        }
      }

      if (shouldBuy) {
        const feeBuffer = 0.995;
        let cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;

        const size = cash / bar.close;

        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY signal (${buyReason}) for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, size: ${size.toFixed(2)}`);
          console.log(`  Bands - Lower: ${bands.lower?.toFixed(4)}, Middle: ${bands.middle?.toFixed(4)}, Upper: ${bands.upper?.toFixed(4)}`);

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
