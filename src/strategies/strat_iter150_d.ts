import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter150DParams extends StrategyParams {
  learning_window: number;
  performance_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter150DParams = {
  learning_window: 20,
  performance_threshold: 0.5,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.12,
  max_hold_bars: 25,
  risk_percent: 0.20,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter150DParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter150_d.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter150DStrategy implements Strategy {
  params: StratIter150DParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();
  private tradeHistory: Map<string, { pnl: number; barNum: number }[]> = new Map();
  private lastEntryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter150DParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter150DParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period) return null;
    const highSlice = highs.slice(-period);
    const lowSlice = lows.slice(-period);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    if (highest === lowest) return 50;
    return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
  }

  private supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
    if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
    return {
      support: Math.min(...lows.slice(-(lookback + 1), -1)),
      resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
    };
  }

  private calcWinRate(history: { pnl: number; barNum: number }[], window: number, currentBar: number): number {
    const recent = history.filter(t => currentBar - t.barNum <= window);
    if (recent.length === 0) return 0.5;
    const wins = recent.filter(t => t.pnl > 0).length;
    return wins / recent.length;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
      this.tradeHistory.set(bar.tokenId, []);
      this.lastEntryBar.set(bar.tokenId, -999);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const history = this.tradeHistory.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 300) closes.shift();
    if (highs.length > 300) highs.shift();
    if (lows.length > 300) lows.shift();

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.low <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          history.push({ pnl: -this.params.stop_loss, barNum });
          return;
        }
        if (bar.high >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          history.push({ pnl: this.params.profit_target, barNum });
          return;
        }
        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          const pnl = (bar.close - entry) / entry;
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          history.push({ pnl, barNum });
          return;
        }
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (closes.length < 14) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const k = this.stochasticK(closes, highs, lows, 14);
    const winRate = this.calcWinRate(history, this.params.learning_window, barNum);
    const nearSupport = bar.low <= sr.support * 1.02;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const goodPerformance = winRate >= this.params.performance_threshold || history.length < 3;

    if (nearSupport && stochOversold && goodPerformance) {
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