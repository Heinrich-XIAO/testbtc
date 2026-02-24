import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter32CParams extends StrategyParams {
  macd_fast: number;
  macd_slow: number;
  macd_signal: number;
  support_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
  histogram_accel_threshold: number;
  histogram_weakening_threshold: number;
}

const defaultParams: StratIter32CParams = {
  macd_fast: 12,
  macd_slow: 26,
  macd_signal: 9,
  support_threshold: 0.015,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 32,
  risk_percent: 0.25,
  sr_lookback: 50,
  histogram_accel_threshold: 0.0005,
  histogram_weakening_threshold: 0.0015,
};

function loadSavedParams(): Partial<StratIter32CParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter32_c.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class StratIter32CStrategy implements Strategy {
  params: StratIter32CParams;
  private priceHistory: Map<string, number[]> = new Map();
  private highHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private fastEMA: Map<string, number | null> = new Map();
  private slowEMA: Map<string, number | null> = new Map();
  private signalEMA: Map<string, number | null> = new Map();
  private histogramHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter32CParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter32CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateEMAValue(prevEma: number | null, price: number, period: number): number {
    const multiplier = 2 / (period + 1);
    if (prevEma === null) return price;
    return (price - prevEma) * multiplier + prevEma;
  }

  private calculateSupportResistance(
    highs: number[],
    lows: number[],
    lookback: number
  ): { support: number; resistance: number } {
    const lowSlice = lows.slice(-lookback);
    const highSlice = highs.slice(-lookback);
    return {
      support: Math.min(...lowSlice),
      resistance: Math.max(...highSlice),
    };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.highHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.fastEMA.set(bar.tokenId, null);
      this.slowEMA.set(bar.tokenId, null);
      this.signalEMA.set(bar.tokenId, null);
      this.histogramHistory.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const highs = this.highHistory.get(bar.tokenId)!;
    const lows = this.lowHistory.get(bar.tokenId)!;
    const hist = this.histogramHistory.get(bar.tokenId)!;

    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    history.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);

    const maxHistory = Math.max(this.params.sr_lookback, this.params.macd_slow) + 10;
    if (history.length > maxHistory) history.shift();
    if (highs.length > maxHistory) highs.shift();
    if (lows.length > maxHistory) lows.shift();

    if (history.length >= this.params.macd_slow) {
      const prevFast = this.fastEMA.get(bar.tokenId) ?? null;
      const prevSlow = this.slowEMA.get(bar.tokenId) ?? null;
      const prevSignal = this.signalEMA.get(bar.tokenId) ?? null;

      const fastEma = this.calculateEMAValue(prevFast, bar.close, this.params.macd_fast);
      const slowEma = this.calculateEMAValue(prevSlow, bar.close, this.params.macd_slow);
      const macdLine = fastEma - slowEma;
      const signalLine = this.calculateEMAValue(prevSignal, macdLine, this.params.macd_signal);
      const histogram = macdLine - signalLine;

      this.fastEMA.set(bar.tokenId, fastEma);
      this.slowEMA.set(bar.tokenId, slowEma);
      this.signalEMA.set(bar.tokenId, signalLine);

      hist.push(histogram);
      if (hist.length > 80) hist.shift();
    }

    if (highs.length < this.params.sr_lookback || lows.length < this.params.sr_lookback || hist.length < 3) {
      return;
    }

    const sr = this.calculateSupportResistance(highs, lows, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    const prevHist = hist[hist.length - 2];
    const currHist = hist[hist.length - 1];
    const prePrevHist = hist[hist.length - 3];

    const prevSlope = prevHist - prePrevHist;
    const currSlope = currHist - prevHist;

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);

      if (entry === undefined || entryBarNum === undefined) return;

      if (bar.low <= entry * (1 - this.params.stop_loss)) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.entryBar.delete(bar.tokenId);
        return;
      }

      if (bar.high >= entry * (1 + this.params.profit_target)) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.entryBar.delete(bar.tokenId);
        return;
      }

      if (bar.close >= sr.resistance) {
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

      const momentumWeakeningSharply =
        currSlope < 0 && (prevSlope - currSlope) >= this.params.histogram_weakening_threshold;

      if (momentumWeakeningSharply) {
        ctx.close(bar.tokenId);
        this.entryPrice.delete(bar.tokenId);
        this.entryBar.delete(bar.tokenId);
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (sr.support <= 0) return;

    const crossedNegToPos = prevHist <= 0 && currHist > 0;
    const increasing = currSlope > 0;
    const accelerating = (currSlope - prevSlope) >= this.params.histogram_accel_threshold;
    const priceNearSupport = (bar.close - sr.support) / sr.support <= this.params.support_threshold;

    if (crossedNegToPos && increasing && accelerating && priceNearSupport) {
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
