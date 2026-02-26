import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter153EParams extends StrategyParams {
  alpha: number;
  entropy_threshold: number;
  lookback: number;
  rsi_oversold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

const defaultParams: StratIter153EParams = {
  alpha: 2,
  entropy_threshold: 0.5,
  lookback: 30,
  rsi_oversold: 30,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.12,
  max_hold_bars: 25,
  risk_percent: 0.20,
};

function loadSavedParams(): Partial<StratIter153EParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter153_e.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter153EStrategy implements Strategy {
  params: StratIter153EParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private volumes: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter153EParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter153EParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private renyiEntropy(returns: number[], alpha: number): number | null {
    if (returns.length < this.params.lookback) return null;
    
    const returnsSlice = returns.slice(-this.params.lookback);
    const min = Math.min(...returnsSlice);
    const max = Math.max(...returnsSlice);
    const range = max - min;
    if (range === 0) return null;

    const numBins = Math.min(10, Math.floor(this.params.lookback / 3));
    const binCounts = new Array(numBins).fill(0);
    
    for (const r of returnsSlice) {
      const binIndex = Math.min(numBins - 1, Math.floor(((r - min) / range) * numBins));
      binCounts[binIndex]++;
    }

    const total = returnsSlice.length;
    const probabilities = binCounts.map(c => c / total);
    
    let sumPwr = 0;
    for (const p of probabilities) {
      if (p > 0) {
        sumPwr += Math.pow(p, alpha);
      }
    }
    
    if (sumPwr <= 0) return null;
    return Math.log(sumPwr) / (1 - alpha);
  }

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

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.volumes.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const volumes = this.volumes.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    volumes.push(bar.volume || 1);
    if (closes.length > 300) closes.shift();
    if (highs.length > 300) highs.shift();
    if (lows.length > 300) lows.shift();
    if (volumes.length > 300) volumes.shift();

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
    if (closes.length < this.params.lookback + 10) return;

    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] !== 0) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      }
    }

    const entropy = this.renyiEntropy(returns, this.params.alpha);
    if (entropy === null) return;

    const k = this.stochasticK(closes, highs, lows, 14);
    const rsi = this.calcRSI(closes, 14);

    if (entropy < this.params.entropy_threshold && 
        k !== null && k < this.params.stoch_oversold &&
        rsi !== null && rsi < this.params.rsi_oversold) {
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
