import type { Strategy, BacktestContext, Bar, StrategyParams, OrderResult } from '../types';
import { SimpleMovingAverage, CrossOver, RSI, ATR } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface SimpleMAStrategyParams extends StrategyParams {
  fast_period: number;
  slow_period: number;
  stop_loss: number;
  trailing_stop: boolean;
  risk_percent: number;
  rsi_enabled: boolean;
  rsi_period: number;
  rsi_oversold: number;
  rsi_overbought: number;
  atr_enabled: boolean;
  atr_multiplier: number;
  take_profit_enabled: boolean;
  take_profit: number;
  exit_strategy: number;
}

const defaultParams: SimpleMAStrategyParams = {
  fast_period: 50,
  slow_period: 200,
  stop_loss: 0.02,
  trailing_stop: false,
  risk_percent: 0.10,
  rsi_enabled: false,
  rsi_period: 14,
  rsi_oversold: 30,
  rsi_overbought: 70,
  atr_enabled: false,
  atr_multiplier: 2.0,
  take_profit_enabled: false,
  take_profit: 0.05,
  exit_strategy: 0,
};

function loadSavedParams(): Partial<SimpleMAStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_simple_ma_01.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<SimpleMAStrategyParams> = {};

    const booleanParams = ['trailing_stop', 'rsi_enabled', 'atr_enabled', 'take_profit_enabled'];

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (booleanParams.includes(key)) {
          if (typeof value === 'number') {
            params[key as keyof SimpleMAStrategyParams] = value === 1;
          } else if (typeof value === 'boolean') {
            params[key as keyof SimpleMAStrategyParams] = value;
          }
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
  private rsi: RSI;
  private atr: ATR;
  private buyPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<SimpleMAStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    // Ensure fast_period < slow_period
    let fast = mergedParams.fast_period;
    let slow = mergedParams.slow_period;
    if (fast >= slow) {
      // Swap them if inverted
      [fast, slow] = [slow, fast];
    }

    this.params = {
      fast_period: fast,
      slow_period: slow,
      stop_loss: mergedParams.stop_loss,
      trailing_stop: mergedParams.trailing_stop,
      risk_percent: mergedParams.risk_percent,
      rsi_enabled: mergedParams.rsi_enabled,
      rsi_period: mergedParams.rsi_period,
      rsi_oversold: mergedParams.rsi_oversold,
      rsi_overbought: mergedParams.rsi_overbought,
      atr_enabled: mergedParams.atr_enabled,
      atr_multiplier: mergedParams.atr_multiplier,
      take_profit_enabled: mergedParams.take_profit_enabled,
      take_profit: mergedParams.take_profit,
      exit_strategy: mergedParams.exit_strategy,
    };
    this.fastMA = new SimpleMovingAverage(this.params.fast_period);
    this.slowMA = new SimpleMovingAverage(this.params.slow_period);
    this.crossover = new CrossOver(this.fastMA, this.slowMA);
    this.rsi = new RSI(this.params.rsi_period);
    this.atr = new ATR(this.params.slow_period);
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`SimpleMAStrategy initialized with params:`);
    console.log(`  Fast MA period: ${this.params.fast_period}`);
    console.log(`  Slow MA period: ${this.params.slow_period}`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Trailing stop: ${this.params.trailing_stop}`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
    console.log(`  RSI: ${this.params.rsi_enabled ? `period=${this.params.rsi_period}, oversold=${this.params.rsi_oversold}, overbought=${this.params.rsi_overbought}` : 'disabled'}`);
    console.log(`  ATR: ${this.params.atr_enabled ? `multiplier=${this.params.atr_multiplier}` : 'disabled'}`);
    console.log(`  Take Profit: ${this.params.take_profit_enabled ? `${this.params.take_profit * 100}%` : 'disabled'}`);
    console.log(`  Exit Strategy: ${this.params.exit_strategy}`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    this.fastMA.update(bar.close);
    this.slowMA.update(bar.close);
    this.crossover.update();
    this.rsi.update(bar.close);
    this.atr.update(bar.high, bar.low, bar.close);

    const position = ctx.getPosition(bar.tokenId);
    const crossoverValue = this.crossover.get(0);
    const rsiValue = this.rsi.get(0);
    const atrValue = this.atr.get(0);

    if (position && position.size > 0) {
      const buyPrice = this.buyPrice.get(bar.tokenId);
      const highest = this.highestPrice.get(bar.tokenId);
      
      if (buyPrice !== undefined) {
        let stopPrice: number;
        
        if (this.params.atr_enabled && atrValue !== undefined && this.params.atr_multiplier > 0) {
          stopPrice = buyPrice - (atrValue * this.params.atr_multiplier);
        } else {
          stopPrice = buyPrice * (1 - this.params.stop_loss);
        }

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
          
          let trailingStopPrice: number;
          if (this.params.atr_enabled && atrValue !== undefined) {
            trailingStopPrice = currentHighest - (atrValue * this.params.atr_multiplier);
          } else {
            trailingStopPrice = currentHighest * (1 - this.params.stop_loss);
          }
          
          if (bar.close <= trailingStopPrice && bar.close > buyPrice) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Trailing stop triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
            return;
          }
        }

        if (this.params.take_profit_enabled) {
          const tpPrice = buyPrice * (1 + this.params.take_profit);
          if (bar.close >= tpPrice) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Take profit triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.buyPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
            return;
          }
        }

        let shouldSell = false;
        
        if (this.params.exit_strategy === 0) {
          if (crossoverValue !== undefined && crossoverValue < 0) {
            shouldSell = true;
          }
        } else if (this.params.exit_strategy === 1) {
          if (this.params.rsi_enabled && rsiValue !== undefined && rsiValue >= this.params.rsi_overbought) {
            shouldSell = true;
          }
        }
        
        if (shouldSell) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] SELL signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}${rsiValue !== undefined ? `, RSI: ${rsiValue.toFixed(2)}` : ''}`);
          ctx.close(bar.tokenId);
          this.buyPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else {
      let shouldBuy = false;
      
      if (crossoverValue !== undefined && crossoverValue > 0) {
        if (this.params.rsi_enabled && rsiValue !== undefined) {
          if (rsiValue <= this.params.rsi_oversold) {
            shouldBuy = true;
          }
        } else {
          shouldBuy = true;
        }
      }
      
      if (shouldBuy) {
        const feeBuffer = 0.995;
        let cash = ctx.getCapital() * this.params.risk_percent * feeBuffer;

        if (this.params.atr_enabled && atrValue !== undefined && this.params.atr_multiplier > 0 && atrValue > 0) {
          const atrRisk = atrValue * this.params.atr_multiplier;
          const maxSizeByATR = (ctx.getCapital() * this.params.risk_percent) / atrRisk;
          cash = Math.min(cash, maxSizeByATR * bar.close * feeBuffer);
        }

        const size = cash / bar.close;

        if (size > 0 && cash <= ctx.getCapital()) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, size: ${size.toFixed(2)}${rsiValue !== undefined ? `, RSI: ${rsiValue.toFixed(2)}` : ''}${atrValue !== undefined ? `, ATR: ${atrValue.toFixed(4)}` : ''}`);

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
