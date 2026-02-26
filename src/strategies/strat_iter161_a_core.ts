import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
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

function williamsR(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) return null;
  const lookback = highs.slice(-period);
  const lowback = lows.slice(-period);
  const highestHigh = Math.max(...lookback);
  const lowestLow = Math.min(...lowback);
  const close = closes[closes.length - 1];
  if (highestHigh === lowestLow) return null;
  return ((highestHigh - close) / (highestHigh - lowestLow)) * -100;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

export interface StratIter161AParams extends StrategyParams {
  wr_period: number;
  wr_oversold: number;
  support_lookback: number;
  support_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter161AStrategy implements Strategy {
  params: StratIter161AParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private wrVals: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter161AParams> = {}) {
    const defaults: StratIter161AParams = {
      wr_period: 14,
      wr_oversold: -85,
      support_lookback: 40,
      support_buffer: 0.015,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    };
    const saved = loadSavedParams<StratIter161AParams>('strat_iter161_a.params.json');
    this.params = { ...defaults, ...saved, ...params } as StratIter161AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
    const cash = ctx.getCapital() * riskPercent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (result.success) {
      this.entryPrice.set(bar.tokenId, bar.close);
      this.entryBar.set(bar.tokenId, barNum);
      return true;
    }
    return false;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.wrVals.has(bar.tokenId)) this.wrVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const wr = williamsR(series.highs, series.lows, series.closes, this.params.wr_period);
    if (wr !== null) capPush(this.wrVals.get(bar.tokenId)!, wr);
    const wrs = this.wrVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.support_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!sr || shouldSkipPrice(bar.close) || wrs.length < this.params.wr_period + 1) return;

    const isOversold = wrs[wrs.length - 1] <= this.params.wr_oversold;
    if (!isOversold) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    if (nearSupport) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
