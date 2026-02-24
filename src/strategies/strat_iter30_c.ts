import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter30CParams extends StrategyParams {
  stoch_k_period: number;
  stoch_d_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  support_threshold: number;
  stop_loss: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
  volume_lookback: number;
  trail_activation: number;
  trail_distance: number;
}

const defaultParams: StratIter30CParams = {
  stoch_k_period: 18,
  stoch_d_period: 3,
  stoch_lookback: 50,
  stoch_oversold: 14,
  stoch_overbought: 86,
  support_threshold: 0.01,
  stop_loss: 0.08,
  max_hold_bars: 32,
  risk_percent: 0.25,
  sr_lookback: 50,
  volume_lookback: 20,
  trail_activation: 0.05,
  trail_distance: 0.03,
};

function loadSavedParams(): Partial<StratIter30CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter30_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StratIter30CStrategy implements Strategy {
  params: StratIter30CParams;
  private priceHistory: Map<string, number[]> = new Map();
  private highHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private volumeHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private dValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();
  private supportResistance: Map<string, { support: number; resistance: number }> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<StratIter30CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter30CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateStochasticK(history: number[], highs: number[], lows: number[], period: number): number | null {
    if (history.length < period) return null;
    const slice = history.slice(-period);
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    const close = history[history.length - 1];
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  private calculateStochasticD(kValues: number[], period: number): number | null {
    if (kValues.length < period) return null;
    const slice = kValues.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
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

  private calculateVolumeAverage(volumes: number[], lookback: number): number | null {
    if (volumes.length < lookback) return null;
    const slice = volumes.slice(-lookback);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.highHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.volumeHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.dValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const highs = this.highHistory.get(bar.tokenId)!;
    const lows = this.lowHistory.get(bar.tokenId)!;
    const volumes = this.volumeHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const dVals = this.dValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    history.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    const vol = (bar as any).volume;
    volumes.push(typeof vol === 'number' && vol > 0 ? vol : 0.001);
    if (history.length > 200) history.shift();
    if (highs.length > 200) highs.shift();
    if (lows.length > 200) lows.shift();
    if (volumes.length > this.params.volume_lookback + 10) volumes.shift();

    const k = this.calculateStochasticK(history, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 100) kVals.shift();

      const d = this.calculateStochasticD(kVals, this.params.stoch_d_period);
      if (d !== null) {
        dVals.push(d);
        if (dVals.length > 100) dVals.shift();
      }
    }

    const sr = this.calculateSupportResistance(history, highs, lows, this.params.sr_lookback);
    this.supportResistance.set(bar.tokenId, sr);

    const volumeAvg = this.calculateVolumeAverage(volumes, this.params.volume_lookback);

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);

      if (entry !== undefined && entryBarNum !== undefined) {
        const highSinceEntry = this.highestPrice.get(bar.tokenId) ?? entry;
        const currentHigh = Math.max(highSinceEntry, bar.close);
        this.highestPrice.set(bar.tokenId, currentHigh);

        if (bar.close <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        const profitPct = (currentHigh - entry) / entry;
        if (profitPct >= this.params.trail_activation) {
          const trailStop = currentHigh * (1 - this.params.trail_distance);
          if (bar.close <= trailStop) {
            ctx.close(bar.tokenId);
            this.entryPrice.delete(bar.tokenId);
            this.entryBar.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
            return;
          }
        }

        if (bar.close >= sr.resistance) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (kVals.length >= 2 && dVals.length >= 2) {
        const prevK = kVals[kVals.length - 2];
        const prevD = dVals[dVals.length - 2];
        const currK = kVals[kVals.length - 1];
        const currD = dVals[dVals.length - 1];

        const crossedAboveOversold = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
        const kAboveD = currK > currD;

        const priceNearSupport = (bar.close - sr.support) / sr.support <= this.params.support_threshold;

        if (crossedAboveOversold && kAboveD && priceNearSupport) {
          const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
          const size = cash / bar.close;
          if (size > 0 && cash <= ctx.getCapital()) {
            const result = ctx.buy(bar.tokenId, size);
            if (result.success) {
              this.entryPrice.set(bar.tokenId, bar.close);
              this.entryBar.set(bar.tokenId, barNum);
              this.highestPrice.set(bar.tokenId, bar.close);
            }
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
