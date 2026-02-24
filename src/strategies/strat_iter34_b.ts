import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter34BParams extends StrategyParams {
  z_lookback: number;
  z_entry_threshold: number;
  z_exit_threshold: number;
  sr_lookback: number;
  support_threshold: number;
  stop_loss: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter34BParams = {
  z_lookback: 24,
  z_entry_threshold: 1.8,
  z_exit_threshold: -0.2,
  sr_lookback: 50,
  support_threshold: 0.012,
  stop_loss: 0.08,
  max_hold_bars: 28,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter34BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter34_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter34BStrategy implements Strategy {
  params: StratIter34BParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private targetPrice: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter34BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter34BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private mean(values: number[]): number {
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private std(values: number[], mean: number): number {
    const variance = values.reduce((sum, v) => {
      const d = v - mean;
      return sum + d * d;
    }, 0) / values.length;
    return Math.sqrt(variance);
  }

  private supportFromPriorBars(lows: number[], lookback: number): number | null {
    if (lows.length < lookback + 1) return null;
    return Math.min(...lows.slice(-(lookback + 1), -1));
  }

  private closePosition(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.targetPrice.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);

    if (closes.length > 320) closes.shift();
    if (highs.length > 320) highs.shift();
    if (lows.length > 320) lows.shift();

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      const target = this.targetPrice.get(bar.tokenId);
      if (entry === undefined || entryBarNum === undefined || target === undefined) return;

      if (bar.low <= entry * (1 - this.params.stop_loss)) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (bar.high >= target) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (barNum - entryBarNum >= this.params.max_hold_bars) {
        this.closePosition(ctx, bar.tokenId);
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (closes.length < this.params.z_lookback + 1) return;

    const zWindow = closes.slice(-(this.params.z_lookback + 1), -1);
    const rollingMean = this.mean(zWindow);
    const rollingStd = this.std(zWindow, rollingMean);
    if (rollingStd < 1e-6) return;

    const support = this.supportFromPriorBars(lows, this.params.sr_lookback);
    if (support === null || support <= 0) return;

    const zScore = (bar.close - rollingMean) / rollingStd;
    const nearSupport = bar.close <= support * (1 + this.params.support_threshold);
    const zOversold = zScore <= -this.params.z_entry_threshold;

    if (zOversold && nearSupport) {
      const target = rollingMean + rollingStd * this.params.z_exit_threshold;
      if (target <= bar.close) return;

      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
          this.targetPrice.set(bar.tokenId, target);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
