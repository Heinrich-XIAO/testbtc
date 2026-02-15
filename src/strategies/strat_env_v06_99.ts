import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Med std envelope
 */

export interface EnvV06StrategyParams extends StrategyParams {
  ma_period: number;
  envelope_pct: number;
  stop_loss: number;
  risk_percent: number;
}

const defaultParams: EnvV06StrategyParams = {
  ma_period: 8,
  envelope_pct: 0.03,
  stop_loss: 0.05,
  risk_percent: 0.12,
};

function loadSavedParams(): Partial<EnvV06StrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_env_v06_99.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<EnvV06StrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof EnvV06StrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class EnvV06Strategy implements Strategy {
  params: EnvV06StrategyParams;
  private smaMap: Map<string, SimpleMovingAverage> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<EnvV06StrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.smaMap.has(bar.tokenId)) {
      this.smaMap.set(bar.tokenId, new SimpleMovingAverage(Math.max(3, Math.floor(this.params.ma_period))));
    }
    const sma = this.smaMap.get(bar.tokenId)!;
    sma.update(bar.close);
    const maVal = sma.get(0);
    if (maVal === undefined) return;

    const upperEnv = maVal * (1 + this.params.envelope_pct);
    const lowerEnv = maVal * (1 - this.params.envelope_pct);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (bar.close >= upperEnv || bar.close >= maVal) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.90) {
      if (bar.close <= lowerEnv) {
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

