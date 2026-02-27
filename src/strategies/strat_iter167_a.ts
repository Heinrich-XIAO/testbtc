import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter167AParams extends StrategyParams {
  top_n: number;
  rank_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  stoch_k_period: number;
}

const defaultParams: StratIter167AParams = {
  top_n: 50,
  rank_period: 20,
  stoch_oversold: 20,
  stop_loss: 0.08,
  profit_target: 0.15,
  max_hold_bars: 28,
  risk_percent: 0.25,
  stoch_k_period: 14,
};

function loadSavedParams(): Partial<StratIter167AParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter167_a.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

interface TokenData {
  closes: number[];
  highs: number[];
  lows: number[];
  kValues: number[];
  barCount: number;
}

export class StratIter167AStrategy implements Strategy {
  params: StratIter167AParams;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private globalBarCount: number = 0;
  private topPerformers: Set<string> = new Set();
  private lastRankBar: number = 0;

  constructor(params: Partial<StratIter167AParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter167AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period || highs.length < period || lows.length < period) return null;
    const windowHigh = Math.max(...highs.slice(-period));
    const windowLow = Math.min(...lows.slice(-period));
    if (windowHigh === windowLow) return 50;
    return ((closes[closes.length - 1] - windowLow) / (windowHigh - windowLow)) * 100;
  }

  private calculatePerformance(tokenId: string, rankPeriod: number): number | null {
    const data = this.tokenData.get(tokenId);
    if (!data || data.closes.length < rankPeriod + 1) return null;
    const startPrice = data.closes[data.closes.length - rankPeriod - 1];
    const endPrice = data.closes[data.closes.length - 1];
    if (startPrice <= 0) return null;
    return (endPrice - startPrice) / startPrice;
  }

  private rankMarkets(ctx: BacktestContext): void {
    const performances: { tokenId: string; performance: number }[] = [];

    this.tokenData.forEach((_, tokenId) => {
      const perf = this.calculatePerformance(tokenId, this.params.rank_period);
      if (perf !== null) {
        performances.push({ tokenId, performance: perf });
      }
    });

    performances.sort((a, b) => b.performance - a.performance);

    this.topPerformers.clear();
    for (let i = 0; i < Math.min(this.params.top_n, performances.length); i++) {
      this.topPerformers.add(performances[i].tokenId);
    }

    this.lastRankBar = this.globalBarCount;
  }

  private clearPositionTracking(tokenId: string): void {
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    this.globalBarCount++;

    if (!this.tokenData.has(bar.tokenId)) {
      this.tokenData.set(bar.tokenId, {
        closes: [],
        highs: [],
        lows: [],
        kValues: [],
        barCount: 0,
      });
    }

    const data = this.tokenData.get(bar.tokenId)!;
    data.closes.push(bar.close);
    data.highs.push(bar.high);
    data.lows.push(bar.low);
    data.barCount++;

    if (data.closes.length > 320) data.closes.shift();
    if (data.highs.length > 320) data.highs.shift();
    if (data.lows.length > 320) data.lows.shift();

    const k = this.stochasticK(data.closes, data.highs, data.lows, this.params.stoch_k_period);
    if (k !== null) {
      data.kValues.push(k);
      if (data.kValues.length > 320) data.kValues.shift();
    }

    if (this.globalBarCount - this.lastRankBar >= this.params.rank_period) {
      this.rankMarkets(ctx);
    }

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBarNum === undefined) return;

      if (bar.low <= entry * (1 - this.params.stop_loss)) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
        return;
      }

      if (bar.high >= entry * (1 + this.params.profit_target)) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
        return;
      }

      if (data.barCount - entryBarNum >= this.params.max_hold_bars) {
        ctx.close(bar.tokenId);
        this.clearPositionTracking(bar.tokenId);
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (data.kValues.length < 2) return;

    if (!this.topPerformers.has(bar.tokenId)) return;

    const prevK = data.kValues[data.kValues.length - 2];
    const currK = data.kValues[data.kValues.length - 1];
    const stochCrossUp = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
    if (!stochCrossUp) return;

    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size > 0 && cash <= ctx.getCapital()) {
      const result = ctx.buy(bar.tokenId, size);
      if (result.success) {
        this.entryPrice.set(bar.tokenId, bar.close);
        this.entryBar.set(bar.tokenId, data.barCount);
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
