import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
};

function loadSavedParams<T extends StrategyParams>(fileName: string): Partial<T> | null {
  const paramsPath = path.join(__dirname, fileName);
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function capPush(values: number[], value: number, max = 500): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

export interface StratIter171BParams extends StrategyParams {
  fast_ma_period: number;
  slow_ma_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter171BStrategy implements Strategy {
  params: StratIter171BParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private prevFastMA: Map<string, number> = new Map();
  private prevSlowMA: Map<string, number> = new Map();

  constructor(params: Partial<StratIter171BParams> = {}) {
    const saved = loadSavedParams<StratIter171BParams>('strat_iter171_b.params.json');
    this.params = {
      fast_ma_period: 10,
      slow_ma_period: 30,
      stop_loss: 0.08,
      profit_target: 0.16,
      max_hold_bars: 24,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter171BParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], volumes: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    capPush(s.volumes, (bar as any).volume || 1);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || 
          bar.high >= e * (1 + this.params.profit_target) || 
          barNum - eb >= this.params.max_hold_bars) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.entryBar.delete(bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || s.closes.length < this.params.slow_ma_period + 1) return;

    const fastMA = sma(s.closes, this.params.fast_ma_period);
    const slowMA = sma(s.closes, this.params.slow_ma_period);
    if (fastMA === null || slowMA === null) return;

    const prevFast = this.prevFastMA.get(bar.tokenId);
    const prevSlow = this.prevSlowMA.get(bar.tokenId);

    this.prevFastMA.set(bar.tokenId, fastMA);
    this.prevSlowMA.set(bar.tokenId, slowMA);

    if (prevFast === undefined || prevSlow === undefined) return;

    // Bullish Crossover: Fast MA crosses above Slow MA
    if (prevFast <= prevSlow && fastMA > slowMA) {
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
