import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, CrossOver, RSI } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Wide MA ribbon for strong trends
 */

export interface RibbonWideStrategyParams extends StrategyParams {
  shortest_period: number;
  period_step: number;
  num_mas: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: RibbonWideStrategyParams = {
  shortest_period: 5,
  period_step: 4,
  num_mas: 5,
  stop_loss: 0.08,
  trailing_stop: 0.06,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<RibbonWideStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_ribbon_wide_29.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<RibbonWideStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof RibbonWideStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}


export class RibbonWideStrategy implements Strategy {
  params: RibbonWideStrategyParams;
  private maArrays: Map<string, SimpleMovingAverage[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<RibbonWideStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params };
  }

  private getMAs(tokenId: string): SimpleMovingAverage[] {
    if (!this.maArrays.has(tokenId)) {
      const periods = [];
      const base = Math.max(3, Math.floor(this.params.shortest_period));
      const step = Math.max(1, Math.floor(this.params.period_step));
      const count = Math.max(3, Math.floor(this.params.num_mas));
      for (let i = 0; i < count; i++) {
        periods.push(base + i * step);
      }
      this.maArrays.set(tokenId, periods.map(p => new SimpleMovingAverage(p)));
    }
    return this.maArrays.get(tokenId)!;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    const mas = this.getMAs(bar.tokenId);
    for (const ma of mas) ma.update(bar.close);

    const values = mas.map(ma => ma.get(0)).filter((v): v is number => v !== undefined);
    if (values.length < mas.length) return;

    // Check if MAs are aligned (all in order = strong trend)
    let bullishAligned = true;
    let bearishAligned = true;
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] <= values[i]) bullishAligned = false;
      if (values[i - 1] >= values[i]) bearishAligned = false;
    }

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);
        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }
        if (bearishAligned || bar.close < values[values.length - 1]) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (bullishAligned && bar.close > values[0]) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}

