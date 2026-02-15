import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * MACD + Stochastic Combo Strategy
 * - Combines MACD crossover with stochastic oversold/overbought
 * - Requires both signals to align within window
 */

export interface MacdStochCombo215Params extends StrategyParams {
  macd_fast: number;
  macd_slow: number;
  macd_signal: number;
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  signal_window: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: MacdStochCombo215Params = {
  macd_fast: 12,
  macd_slow: 26,
  macd_signal: 9,
  stoch_k_period: 14,
  stoch_d_period: 3,
  stoch_oversold: 20,
  stoch_overbought: 80,
  signal_window: 3,
  stop_loss: 0.05,
  trailing_stop: 0.03,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<MacdStochCombo215Params> | null {
  const paramsPath = path.join(__dirname, 'strat_macd_stoch_combo_215.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<MacdStochCombo215Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof MacdStochCombo215Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

interface TokenData {
  prices: number[];
  fastEMA: number;
  slowEMA: number;
  macdLine: number[];
  signalLine: number;
  kValues: number[];
  macdCrossUpBar: number;
  stochOversoldBar: number;
  barCount: number;
}

export class MacdStochCombo215Strategy implements Strategy {
  params: MacdStochCombo215Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<MacdStochCombo215Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as MacdStochCombo215Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, {
        prices: [],
        fastEMA: 0,
        slowEMA: 0,
        macdLine: [],
        signalLine: 0,
        kValues: [],
        macdCrossUpBar: -100,
        stochOversoldBar: -100,
        barCount: 0,
      });
    }
    return this.tokenData.get(tokenId)!;
  }

  private updateEMA(prevEMA: number, price: number, period: number): number {
    const k = 2 / (period + 1);
    return price * k + prevEMA * (1 - k);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const data = this.getOrCreateData(bar.tokenId);
    data.prices.push(bar.close);
    data.barCount++;

    const maxPeriod = Math.max(this.params.macd_slow, this.params.stoch_k_period) + 10;
    if (data.prices.length > maxPeriod) data.prices.shift();

    // Need enough data
    if (data.prices.length < this.params.macd_slow) return;

    // Update MACD
    if (data.fastEMA === 0) {
      data.fastEMA = data.prices.slice(-this.params.macd_fast).reduce((a, b) => a + b, 0) / this.params.macd_fast;
      data.slowEMA = data.prices.slice(-this.params.macd_slow).reduce((a, b) => a + b, 0) / this.params.macd_slow;
    } else {
      data.fastEMA = this.updateEMA(data.fastEMA, bar.close, this.params.macd_fast);
      data.slowEMA = this.updateEMA(data.slowEMA, bar.close, this.params.macd_slow);
    }

    const prevMacd = data.macdLine.length > 0 ? data.macdLine[data.macdLine.length - 1] : 0;
    const macd = data.fastEMA - data.slowEMA;
    data.macdLine.push(macd);
    if (data.macdLine.length > this.params.macd_signal + 1) data.macdLine.shift();

    if (data.macdLine.length >= this.params.macd_signal) {
      const prevSignal = data.signalLine;
      data.signalLine = this.updateEMA(data.signalLine || data.macdLine[0], macd, this.params.macd_signal);
      
      // Check for MACD cross up
      if (prevMacd <= prevSignal && macd > data.signalLine) {
        data.macdCrossUpBar = data.barCount;
      }
    }

    // Update Stochastic
    if (data.prices.length >= this.params.stoch_k_period) {
      const slice = data.prices.slice(-this.params.stoch_k_period);
      const high = Math.max(...slice);
      const low = Math.min(...slice);
      const k = high === low ? 50 : ((bar.close - low) / (high - low)) * 100;
      
      data.kValues.push(k);
      if (data.kValues.length > this.params.stoch_d_period) data.kValues.shift();

      // Check for stochastic oversold
      if (k <= this.params.stoch_oversold) {
        data.stochOversoldBar = data.barCount;
      }
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const highest = this.highestPrice.get(bar.tokenId) ?? bar.close;

      if (entry) {
        if (bar.close > highest) {
          this.highestPrice.set(bar.tokenId, bar.close);
        }
        const newHighest = this.highestPrice.get(bar.tokenId)!;

        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.clearPosition(bar.tokenId);
          return;
        }

        if (bar.close < newHighest * (1 - this.params.trailing_stop)) {
          ctx.close(bar.tokenId);
          this.clearPosition(bar.tokenId);
          return;
        }

        // Exit on stochastic overbought
        const k = data.kValues.length > 0 ? data.kValues[data.kValues.length - 1] : 50;
        if (k >= this.params.stoch_overbought) {
          ctx.close(bar.tokenId);
          this.clearPosition(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: both MACD cross up and stochastic oversold within signal_window bars
      const macdRecent = (data.barCount - data.macdCrossUpBar) <= this.params.signal_window;
      const stochRecent = (data.barCount - data.stochOversoldBar) <= this.params.signal_window;

      if (macdRecent && stochRecent) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
            // Reset signals to prevent re-entry
            data.macdCrossUpBar = -100;
            data.stochOversoldBar = -100;
          }
        }
      }
    }
  }

  private clearPosition(tokenId: string): void {
    this.entryPrice.delete(tokenId);
    this.highestPrice.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
}
