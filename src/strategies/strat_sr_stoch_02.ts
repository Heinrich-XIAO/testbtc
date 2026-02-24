import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface SrStoch02Params extends StrategyParams {
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  bounce_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: SrStoch02Params = {
  stoch_k_period: 14,
  stoch_oversold: 16,
  stoch_overbought: 84,
  bounce_threshold: 0.01,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<SrStoch02Params> | null {
  const paramsPath = path.join(__dirname, 'strat_sr_stoch_02.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export class SrStoch02Strategy implements Strategy {
  params: SrStoch02Params;
  private priceHistory: Map<string, number[]> = new Map();
  private lowHistory: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<SrStoch02Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as SrStoch02Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private calculateStochasticK(history: number[], period: number): number | null {
    if (history.length < period) return null;
    const slice = history.slice(-period);
    const highest = Math.max(...slice);
    const lowest = Math.min(...slice);
    if (highest === lowest) return 50;
    const close = history[history.length - 1];
    return ((close - lowest) / (highest - lowest)) * 100;
  }

  private calculateSupport(lowHistory: number[], lookback: number): number | null {
    if (lowHistory.length < lookback) return null;
    const slice = lowHistory.slice(-lookback);
    return Math.min(...slice);
  }

  private checkBounce(low: number, close: number, support: number, threshold: number): boolean {
    const nearSupport = low <= support * (1 + threshold);
    const closedHigher = close > low;
    return nearSupport && closedHigher;
  }

  private touchedSupportRecently(lowHist: number[], support: number, threshold: number, bars: number): boolean {
    const recent = lowHist.slice(-bars);
    return recent.some(low => low <= support * (1 + threshold));
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.lowHistory.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const lowHist = this.lowHistory.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    history.push(bar.close);
    lowHist.push(bar.low);
    if (history.length > 200) history.shift();
    if (lowHist.length > 200) lowHist.shift();

    const k = this.calculateStochasticK(history, this.params.stoch_k_period);
    if (k !== null) {
      kVals.push(k);
      if (kVals.length > 100) kVals.shift();
    }

    const support = this.calculateSupport(lowHist, this.params.sr_lookback);
    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.close <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }

        if (bar.close >= entry * (1 + this.params.profit_target)) {
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
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      if (kVals.length >= 2) {
        const prevK = kVals[kVals.length - 2];
        const currK = kVals[kVals.length - 1];

        const stochCross = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold;
        
        let bounce = true;
        if (support !== null) {
          const nearSupport = bar.low <= support * (1 + this.params.bounce_threshold);
          bounce = nearSupport && bar.close > bar.low;
        }

        if (stochCross && bounce) {
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
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
