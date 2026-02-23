import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StochBaseline02Params extends StrategyParams {
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StochBaseline02Params = {
  stoch_k_period: 14,
  stoch_d_period: 3,
  stoch_oversold: 14,
  stoch_overbought: 86,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StochBaseline02Params> | null {
  const paramsPath = path.join(__dirname, 'strat_stoch_baseline_02.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

class Stochastic {
  private kPeriod: number;
  private dPeriod: number;
  private highs: number[] = [];
  private lows: number[] = [];
  private closes: number[] = [];
  private kValues: number[] = [];
  private dValues: number[] = [];

  constructor(kPeriod: number, dPeriod: number) {
    this.kPeriod = kPeriod;
    this.dPeriod = dPeriod;
  }

  update(high: number, low: number, close: number): { k: number; d: number } | null {
    this.highs.push(high);
    this.lows.push(low);
    this.closes.push(close);

    if (this.highs.length > this.kPeriod) {
      this.highs.shift();
      this.lows.shift();
      this.closes.shift();
    }

    if (this.highs.length < this.kPeriod) {
      return null;
    }

    const highestHigh = Math.max(...this.highs);
    const lowestLow = Math.min(...this.lows);
    const range = highestHigh - lowestLow;

    let k = 50;
    if (range > 0) {
      k = ((close - lowestLow) / range) * 100;
    }

    this.kValues.push(k);
    if (this.kValues.length > this.dPeriod * 2) {
      this.kValues.shift();
    }

    if (this.kValues.length < this.dPeriod) {
      return null;
    }

    const d = this.kValues.slice(-this.dPeriod).reduce((a, b) => a + b, 0) / this.dPeriod;
    this.dValues.push(d);
    if (this.dValues.length > 100) {
      this.dValues.shift();
    }

    return { k, d };
  }

  getK(index: number = 0): number | undefined {
    return this.kValues[this.kValues.length - 1 - index];
  }

  getD(index: number = 0): number | undefined {
    return this.dValues[this.dValues.length - 1 - index];
  }
}

export class StochBaseline02Strategy implements Strategy {
  params: StochBaseline02Params;
  private stoch: Map<string, Stochastic> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();

  constructor(params: Partial<StochBaseline02Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  private getSupportResistance(lows: number[], highs: number[], lookback: number): { support: number; resistance: number } {
    const sliceLows = lows.slice(-lookback);
    const sliceHighs = highs.slice(-lookback);
    const support = sliceLows.length > 0 ? Math.min(...sliceLows) : 0;
    const resistance = sliceHighs.length > 0 ? Math.max(...sliceHighs) : 1;
    return { support, resistance };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.stoch.has(bar.tokenId)) {
      this.stoch.set(bar.tokenId, new Stochastic(this.params.stoch_k_period, this.params.stoch_d_period));
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    highs.push(bar.high);
    lows.push(bar.low);
    if (highs.length > this.params.sr_lookback * 2) highs.shift();
    if (lows.length > this.params.sr_lookback * 2) lows.shift();

    const barCount = this.barCount.get(bar.tokenId)! + 1;
    this.barCount.set(bar.tokenId, barCount);

    const stoch = this.stoch.get(bar.tokenId)!;
    const stochResult = stoch.update(bar.high, bar.low, bar.close);

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId) || bar.close;
      const entryBarNum = this.entryBar.get(bar.tokenId) || 0;
      const barsHeld = barCount - entryBarNum;

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

      if (barsHeld >= this.params.max_hold_bars) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.entryBar.delete(bar.tokenId);
        return;
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (!stochResult) return;

      const { k, d } = stochResult;
      const prevK = stoch.getK(1);

      if (prevK === undefined) return;

      const crossedAboveOversold = prevK < this.params.stoch_oversold && k >= this.params.stoch_oversold;
      const kAboveD = k > d;

      if (crossedAboveOversold && kAboveD) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.entryBar.set(bar.tokenId, barCount);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
