import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter5AParams extends StrategyParams {
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  support_threshold: number;
  resistance_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
  momentum_threshold: number;
}

const defaultParams: StratIter5AParams = {
  stoch_k_period: 14,
  stoch_oversold: 14,
  stoch_overbought: 82,
  support_threshold: 0.03,
  resistance_threshold: 0.98,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 80,
  momentum_threshold: 0.01,
};

function loadSavedParams(): Partial<StratIter5AParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter5_a.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StratIter5AStrategy implements Strategy {
  params: StratIter5AParams;
  private priceHistory: Map<string, number[]> = new Map();
  private highHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();
  private supportResistance: Map<string, { support: number; resistance: number }> = new Map();

  constructor(params: Partial<StratIter5AParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter5AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateStochasticK(history: number[], period: number): number | null {
    if (history.length < period) return null;
    const slice = history.slice(-period);
    const highest = Math.max(...slice);
    const lowest = Math.min(...slice);
    if (highest === lowest) return 50;
    const close = history[history.length - 1];
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  private calculateMomentum(history: number[], period: number): number | null {
    if (history.length < period + 1) return null;
    const current = history[history.length - 1];
    const past = history[history.length - 1 - period];
    return (current - past) / past;
  }

  private calculateSupportResistance(
    history: number[],
    highs: number[],
    lows: number[],
    lookback: number
  ): { support: number; resistance: number } {
    const lowSlice = lows.slice(-lookback);
    const highSlice = highs.slice(-lookback);
    return {
      support: Math.min(...lowSlice),
      resistance: Math.max(...highSlice),
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.highHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const highs = this.highHistory.get(bar.tokenId)!;
    const lows = this.lowHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    history.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (history.length > 200) history.shift();
    if (highs.length > 200) highs.shift();
    if (lows.length > 200) lows.shift();

    const k = this.calculateStochasticK(history, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 100) kVals.shift();
    }

    const sr = this.calculateSupportResistance(history, highs, lows, this.params.sr_lookback);
    this.supportResistance.set(bar.tokenId, sr);

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);

      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.close <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (bar.close >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (bar.close >= sr.resistance * this.params.resistance_threshold) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (kVals.length >= 2) {
        const prevK = kVals[kVals.length - 2];
        const currK = kVals[kVals.length - 1];

        if (prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold) {
          const momentum = this.calculateMomentum(history, 10);
          if (momentum !== null && momentum > this.params.momentum_threshold) {
            const nearSupport = bar.close <= sr.support * (1 + this.params.support_threshold);

            if (nearSupport) {
              const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
              const size = cash / bar.close;
              if (size > 0 && cash <= ctx.getCapital()) {
                const result = ctx.buy(bar.tokenId, size);
                if (result.success) {
                  this.entryPrice.set(bar.tokenId, bar.close);
                  this.entryBar.set(bar.tokenId, barNum);
                }
              }
            }
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
