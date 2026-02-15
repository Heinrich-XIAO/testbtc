import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Quick cycle MR+RSI
 */

export interface MRRsiV19StrategyParams extends StrategyParams {
  ma_period: number;
  rsi_period: number;
  deviation_threshold: number;
  rsi_oversold: number;
  rsi_overbought: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: MRRsiV19StrategyParams = {
  ma_period: 3,
  rsi_period: 3,
  deviation_threshold: 0.02,
  rsi_oversold: 30,
  rsi_overbought: 70,
  stop_loss: 0.04,
  risk_percent: 0.12,
};

function loadSavedParams(): Partial<MRRsiV19StrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_mr_rsi_v19_72.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<MRRsiV19StrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof MRRsiV19StrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class MRRsiV19Strategy implements Strategy {
  params: MRRsiV19StrategyParams;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private rsiMap: Map<string, RSI> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<MRRsiV19StrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.smaMap.has(bar.tokenId)) {
      this.smaMap.set(bar.tokenId, new SimpleMovingAverage(Math.max(3, Math.floor(this.params.ma_period))));
      this.rsiMap.set(bar.tokenId, new RSI(Math.max(3, Math.floor(this.params.rsi_period))));
    }
    const sma = this.smaMap.get(bar.tokenId)!;
    const rsi = this.rsiMap.get(bar.tokenId)!;
    sma.update(bar.close);
    rsi.update(bar.close);

    const maVal = sma.get(0);
    const rsiVal = rsi.get(0);
    if (maVal === undefined || rsiVal === undefined) return;

    const deviation = (maVal - bar.close) / maVal;
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (bar.close >= maVal || rsiVal >= this.params.rsi_overbought) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.90) {
      if (deviation >= this.params.deviation_threshold && rsiVal <= this.params.rsi_oversold) {
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

