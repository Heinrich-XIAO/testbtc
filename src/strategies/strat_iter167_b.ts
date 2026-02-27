import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter167BParams extends StrategyParams {
  gap_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter167BParams = {
  gap_threshold: 0.02,
  stop_loss: 0.08,
  profit_target: 0.08,
  max_hold_bars: 5,
  risk_percent: 0.25,
};

function loadSavedParams(): Partial<StratIter167BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter167_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter167BStrategy implements Strategy {
  params: StratIter167BParams;
  private prevClose: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter167BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter167BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private closePosition(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.barCount.has(bar.tokenId)) {
      this.barCount.set(bar.tokenId, 0);
    }

    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    // Store previous close for next bar's gap calculation
    const prevClose = this.prevClose.get(bar.tokenId);
    this.prevClose.set(bar.tokenId, bar.close);

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBarNum === undefined) return;

      // Check stop loss
      if (bar.low <= entry * (1 - this.params.stop_loss)) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      // Check profit target
      if (bar.high >= entry * (1 + this.params.profit_target)) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      // Check max hold bars
      if (barNum - entryBarNum >= this.params.max_hold_bars) {
        this.closePosition(ctx, bar.tokenId);
      }
      return;
    }

    // Need previous close to calculate gap
    if (prevClose === undefined || prevClose <= 0) return;
    if (bar.open <= 0) return;

    // Calculate overnight gap: (open - prev_close) / prev_close
    const gap = (bar.open - prevClose) / prevClose;

    // Gap down > threshold: Long (mean reversion)
    // Price gapped down significantly, expect mean reversion up
    if (gap < -this.params.gap_threshold) {
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

  onComplete(_ctx: BacktestContext): void {}
}
