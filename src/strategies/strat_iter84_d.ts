import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter84DParams extends StrategyParams {
  window_size: number;
  p_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter84DParams = {
  window_size: 40,
  p_threshold: 0.10,
  stoch_oversold: 16,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter84DParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter84_d.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

export class StratIter84DStrategy implements Strategy {
  params: StratIter84DParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();
  private lastChangePoint: Map<string, number> = new Map();
  private lastRegime: Map<string, 'bullish' | 'bearish' | null> = new Map();

  constructor(params: Partial<StratIter84DParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter84DParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private pettittTest(data: number[]): { changePoint: number; pValue: number; U: number } | null {
    const n = data.length;
    if (n < 4) return null;

    let maxU = 0;
    let changePointIdx = 0;

    for (let t = 1; t < n; t++) {
      let U_t = 0;
      for (let i = 0; i < t; i++) {
        for (let j = t; j < n; j++) {
          if (data[i] < data[j]) U_t++;
          else if (data[i] > data[j]) U_t--;
        }
      }
      if (Math.abs(U_t) > Math.abs(maxU)) {
        maxU = U_t;
        changePointIdx = t;
      }
    }

    const pValue = 2 * Math.exp((-6 * maxU * maxU) / (n * (n * n - 1)));

    return { changePoint: changePointIdx, pValue, U: maxU };
  }

  private detectRegimeChange(data: number[], changePoint: number): 'bullish' | 'bearish' | null {
    if (changePoint <= 0 || changePoint >= data.length - 1) return null;

    const beforeMean = data.slice(0, changePoint).reduce((a, b) => a + b, 0) / changePoint;
    const afterMean = data.slice(changePoint).reduce((a, b) => a + b, 0) / (data.length - changePoint);

    if (afterMean < beforeMean * 0.98) return 'bearish';
    if (afterMean > beforeMean * 1.02) return 'bullish';
    return null;
  }

  private stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
    if (closes.length < period) return null;
    const windowHigh = Math.max(...highs.slice(-period));
    const windowLow = Math.min(...lows.slice(-period));
    if (windowHigh === windowLow) return 50;
    return ((closes[closes.length - 1] - windowLow) / (windowHigh - windowLow)) * 100;
  }

  private supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } {
    return {
      support: Math.min(...lows.slice(-lookback)),
      resistance: Math.max(...highs.slice(-lookback)),
    };
  }

  private closePosition(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
      this.lastChangePoint.set(bar.tokenId, -1);
      this.lastRegime.set(bar.tokenId, null);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    closes.push(bar.close);
    highs.push(bar.high);
    lows.push(bar.low);
    if (closes.length > 400) closes.shift();
    if (highs.length > 400) highs.shift();
    if (lows.length > 400) lows.shift();

    const position = ctx.getPosition(bar.tokenId);
    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBarNum === undefined) return;

      if (bar.low <= entry * (1 - this.params.stop_loss)) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (bar.high >= entry * (1 + this.params.profit_target)) {
        this.closePosition(ctx, bar.tokenId);
        return;
      }

      if (barNum - entryBarNum >= this.params.max_hold_bars) {
        this.closePosition(ctx, bar.tokenId);
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (closes.length < this.params.window_size) return;
    if (highs.length < this.params.sr_lookback || lows.length < this.params.sr_lookback) return;

    const sr = this.supportResistance(highs, lows, this.params.sr_lookback);
    if (sr.support <= 0) return;

    const window = closes.slice(-this.params.window_size);
    const pettitt = this.pettittTest(window);

    if (pettitt && pettitt.pValue <= this.params.p_threshold) {
      const regime = this.detectRegimeChange(window, pettitt.changePoint);
      if (regime) {
        const lastCP = this.lastChangePoint.get(bar.tokenId) || -1;
        if (pettitt.changePoint > lastCP) {
          this.lastChangePoint.set(bar.tokenId, pettitt.changePoint);
          this.lastRegime.set(bar.tokenId, regime);
        }
      }
    }

    const currentRegime = this.lastRegime.get(bar.tokenId);
    const k = this.stochasticK(closes, highs, lows, 14);

    if (currentRegime === 'bearish' && k !== null && k <= this.params.stoch_oversold) {
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
