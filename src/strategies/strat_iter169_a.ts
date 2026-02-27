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

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const mult = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = (values[i] - ema) * mult + ema;
  }
  return ema;
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

export interface StratIter169AParams extends StrategyParams {
  macd_fast: number;
  macd_slow: number;
  macd_signal: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter169AStrategy implements Strategy {
  params: StratIter169AParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private prevMacd: Map<string, number> = new Map();
  private prevSignal: Map<string, number> = new Map();

  constructor(params: Partial<StratIter169AParams> = {}) {
    const saved = loadSavedParams<StratIter169AParams>('strat_iter169_a.params.json');
    this.params = {
      macd_fast: 12,
      macd_slow: 26,
      macd_signal: 9,
      stop_loss: 0.08,
      profit_target: 0.16,
      max_hold_bars: 24,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter169AParams;
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

    if (shouldSkipPrice(bar.close) || s.closes.length < this.params.macd_slow + this.params.macd_signal) return;

    const fastEma = ema(s.closes, this.params.macd_fast);
    const slowEma = ema(s.closes, this.params.macd_slow);
    if (fastEma === null || slowEma === null) return;

    const macdLine = fastEma - slowEma;
    
    // Calculate signal line (EMA of MACD)
    const macdHistory = this.getMacdHistory(s.closes);
    const signalLine = ema(macdHistory, this.params.macd_signal);
    if (signalLine === null) return;

    const prevMacd = this.prevMacd.get(bar.tokenId);
    const prevSignal = this.prevSignal.get(bar.tokenId);

    this.prevMacd.set(bar.tokenId, macdLine);
    this.prevSignal.set(bar.tokenId, signalLine);

    if (prevMacd === undefined || prevSignal === undefined) return;

    // Bullish crossover: MACD crosses above signal
    if (prevMacd <= prevSignal && macdLine > signalLine) {
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

  private getMacdHistory(closes: number[]): number[] {
    const macdValues: number[] = [];
    for (let i = this.params.macd_slow; i <= closes.length; i++) {
      const slice = closes.slice(0, i);
      const fast = ema(slice, this.params.macd_fast);
      const slow = ema(slice, this.params.macd_slow);
      if (fast !== null && slow !== null) {
        macdValues.push(fast - slow);
      }
    }
    return macdValues;
  }

  onComplete(_ctx: BacktestContext): void {}
}
