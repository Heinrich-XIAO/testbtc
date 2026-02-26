import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  sar: number[];
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

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return 50;
  return ((closes[closes.length - 1] - l) / (h - l)) * 100;
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function calculateSAR(highs: number[], lows: number[], af: number, maxAF: number): { sar: number; isLong: boolean } | null {
  if (highs.length < 5 || lows.length < 5) return null;
  
  const sarValues: number[] = [];
  let isLong = true;
  let ep = lows[0];
  let currentAF = af;
  let sar = highs[0];
  
  for (let i = 1; i < highs.length; i++) {
    sar = sar + currentAF * (ep - sar);
    
    if (isLong) {
      sar = Math.min(sar, lows[i - 1], lows[Math.max(0, i - 2)]);
      if (lows[i] < sar) {
        isLong = false;
        sar = ep;
        ep = lows[i];
        currentAF = af;
      } else if (highs[i] > ep) {
        ep = highs[i];
        currentAF = Math.min(currentAF + af, maxAF);
      }
    } else {
      sar = Math.max(sar, highs[i - 1], highs[Math.max(0, i - 2)]);
      if (highs[i] > sar) {
        isLong = true;
        sar = ep;
        ep = highs[i];
        currentAF = af;
      } else if (lows[i] < ep) {
        ep = lows[i];
        currentAF = Math.min(currentAF + af, maxAF);
      }
    }
    
    sarValues.push(sar);
  }
  
  return { sar: sarValues[sarValues.length - 1], isLong };
}

abstract class BaseIterStrategy<P extends StrategyParams> implements Strategy {
  params: P;
  protected series: Map<string, TokenSeries> = new Map();
  protected bars: Map<string, number> = new Map();
  protected entryPrice: Map<string, number> = new Map();
  protected entryBar: Map<string, number> = new Map();

  constructor(fileName: string, defaults: P, params: Partial<P>) {
    const saved = loadSavedParams<P>(fileName);
    this.params = { ...defaults, ...saved, ...params } as P;
  }

  onInit(_ctx: BacktestContext): void {}

  protected nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], sar: [] });
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

  protected open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
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

  protected close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter119CParams extends StrategyParams {
  sar_af: number;
  sar_max_af: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter119CStrategy extends BaseIterStrategy<StratIter119CParams> {
  constructor(params: Partial<StratIter119CParams> = {}) {
    super('strat_iter119_c.params.json', {
      sar_af: 0.02,
      sar_max_af: 0.2,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  private prevIsLong: Map<string, boolean> = new Map();

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    const sar = calculateSAR(series.highs, series.lows, this.params.sar_af, this.params.sar_max_af);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sar) return;

    if (!this.prevIsLong.has(bar.tokenId)) {
      this.prevIsLong.set(bar.tokenId, sar.isLong);
    }

    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const prevLong = this.prevIsLong.get(bar.tokenId)!;
    const sarReversal = !prevLong && sar.isLong;

    this.prevIsLong.set(bar.tokenId, sar.isLong);

    if (stochOversold && sarReversal) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
