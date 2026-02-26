import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter150BParams extends StrategyParams {
  vote_threshold: number;
  rsi_oversold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter150BParams = {
  vote_threshold: 3,
  rsi_oversold: 30,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.12,
  max_hold_bars: 25,
  risk_percent: 0.20,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter150BParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter150_b.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter150BStrategy implements Strategy {
  params: StratIter150BParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter150BParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter150BParams;
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

  private calcRSI(closes: number[], period: number): number | null {
    if (closes.length < period + 1) return null;
    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }
    const recentChanges = changes.slice(-period);
    const gains = recentChanges.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
    const losses = Math.abs(recentChanges.filter(c => c < 0).reduce((a, b) => a + b, 0) / period);
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  }

  private calcMACD(closes: number[]): { macd: number; signal: number } | null {
    if (closes.length < 26) return null;
    const ema12 = this.calcEMA(closes, 12);
    const ema26 = this.calcEMA(closes, 26);
    if (!ema12 || !ema26) return null;
    const macd = ema12 - ema26;
    return { macd, signal: macd * 0.8 };
  }

  private calcEMA(closes: number[], period: number): number | null {
    if (closes.length < period) return null;
    const multiplier = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
      ema = (closes[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  private supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
    if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
    return {
      support: Math.min(...lows.slice(-(lookback + 1), -1)),
      resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
    };
  }

  private ensembleVote(closes: number[], highs: number[], lows: number[], sr: { support: number; resistance: number }, price: number): number {
    let votes = 0;
    const k = this.stochasticK(closes, highs, lows, 14);
    if (k !== null && k < this.params.stoch_oversold) votes++;
    const rsi = this.calcRSI(closes, 14);
    if (rsi !== null && rsi < this.params.rsi_oversold) votes++;
    const macd = this.calcMACD(closes);
    if (macd && macd.macd > macd.signal) votes++;
    if (price <= sr.support * 1.02) votes++;
    if (price < closes[closes.length - 2]) votes++;
    return votes;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
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
          return;
        }
        if (bar.high >= entry * (1 + this.params.profit_target)) {
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
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (closes.length < 26) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const votes = this.ensembleVote(closes, highs, lows, sr, bar.close);

    if (votes >= this.params.vote_threshold) {
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