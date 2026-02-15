import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Ultra-fast combo
 */

export interface ComboV01StrategyParams extends StrategyParams {
  bb_period: number;
  rsi_period: number;
  std_mult: number;
  rsi_oversold: number;
  rsi_overbought: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: ComboV01StrategyParams = {
  bb_period: 4,
  rsi_period: 3,
  std_mult: 1.5,
  rsi_oversold: 25,
  rsi_overbought: 75,
  stop_loss: 0.03,
  risk_percent: 0.08,
};

function loadSavedParams(): Partial<ComboV01StrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_combo_v01_134.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<ComboV01StrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof ComboV01StrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


class StdDev {
  private prices: number[] = [];
  private period: number;
  constructor(period: number) { this.period = period; }
  update(price: number): void {
    this.prices.push(price);
    if (this.prices.length > this.period) this.prices.shift();
  }
  get(): number | undefined {
    if (this.prices.length < this.period) return undefined;
    const mean = this.prices.reduce((a, b) => a + b, 0) / this.prices.length;
    return Math.sqrt(this.prices.reduce((s, p) => s + (p - mean) ** 2, 0) / this.prices.length);
  }
}

export class ComboV01Strategy implements Strategy {
  params: ComboV01StrategyParams;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private stdMap: Map<string, StdDev> = new Map();
  private rsiMap: Map<string, RSI> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<ComboV01StrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    const period = Math.max(3, Math.floor(this.params.bb_period));
    if (!this.smaMap.has(bar.tokenId)) {
      this.smaMap.set(bar.tokenId, new SimpleMovingAverage(period));
      this.stdMap.set(bar.tokenId, new StdDev(period));
      this.rsiMap.set(bar.tokenId, new RSI(Math.max(3, Math.floor(this.params.rsi_period))));
    }
    const sma = this.smaMap.get(bar.tokenId)!;
    const std = this.stdMap.get(bar.tokenId)!;
    const rsi = this.rsiMap.get(bar.tokenId)!;
    sma.update(bar.close);
    std.update(bar.close);
    rsi.update(bar.close);

    const maVal = sma.get(0);
    const stdVal = std.get();
    const rsiVal = rsi.get(0);
    if (maVal === undefined || stdVal === undefined || rsiVal === undefined) return;

    const lowerBand = maVal - this.params.std_mult * stdVal;
    const upperBand = maVal + this.params.std_mult * stdVal;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (bar.close >= upperBand || rsiVal >= this.params.rsi_overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.90) {
      if (bar.close <= lowerBand && rsiVal <= this.params.rsi_oversold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}

