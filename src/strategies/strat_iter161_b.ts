import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter161BParams extends StrategyParams {
  wr_period: number;
  z_window: number;
  z_threshold: number;
  support_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter161BParams = {
  wr_period: 14,
  z_window: 20,
  z_threshold: -1.5,
  support_threshold: 0.01,
  stop_loss: 0.08,
  profit_target: 0.14,
  max_hold_bars: 24,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter161BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter161_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function williamsR(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (highs.length < period || lows.length < period || closes.length < period) return null;
  const highSlice = highs.slice(-period);
  const lowSlice = lows.slice(-period);
  const close = closes[closes.length - 1];
  const highest = Math.max(...highSlice);
  const lowest = Math.min(...lowSlice);
  if (highest === lowest) return -50;
  return -100 * ((highest - close) / (highest - lowest));
}

function zScore(values: number[], window: number): number | null {
  if (values.length < window) return null;
  const slice = values.slice(-window);
  const mean = slice.reduce((a, b) => a + b, 0) / window;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / window;
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  const current = values[values.length - 1];
  return (current - mean) / std;
}

function supportResistance(
  closes: number[],
  highs: number[],
  lows: number[],
  lookback: number
): { support: number; resistance: number } | null {
  if (closes.length < lookback || highs.length < lookback || lows.length < lookback) return null;
  const lowSlice = lows.slice(-lookback);
  const highSlice = highs.slice(-lookback);
  return {
    support: Math.min(...lowSlice),
    resistance: Math.max(...highSlice),
  };
}

export class StratIter161BStrategy implements Strategy {
  params: StratIter161BParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private wrValues: Map<string, number[]> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter161BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter161BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.wrValues.set(bar.tokenId, []);
      this.bars.set(bar.tokenId, 0);
    }

    const c = this.closes.get(bar.tokenId)!;
    const h = this.highs.get(bar.tokenId)!;
    const l = this.lows.get(bar.tokenId)!;
    const wr = this.wrValues.get(bar.tokenId)!;
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);

    c.push(bar.close);
    h.push(bar.high);
    l.push(bar.low);
    if (c.length > 200) c.shift();
    if (h.length > 200) h.shift();
    if (l.length > 200) l.shift();

    const wrVal = williamsR(h, l, c, this.params.wr_period);
    if (wrVal !== null) {
      wr.push(wrVal);
      if (wr.length > 100) wr.shift();
    }

    const sr = supportResistance(c, h, l, this.params.sr_lookback);

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
      }
    } else if (bar.close > 0.05 && bar.close < 0.95 && sr !== null) {
      const z = zScore(wr, this.params.z_window);

      if (z !== null && z < this.params.z_threshold) {
        const priceNearSupport = (bar.close - sr.support) / sr.support <= this.params.support_threshold;

        if (priceNearSupport) {
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

  onComplete(_ctx: BacktestContext): void {}
}
