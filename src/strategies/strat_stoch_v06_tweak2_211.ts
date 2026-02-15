import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Stoch V06 Tweak2 - Enable MTF confirmation
 * Based on stoch_v06_tweak_202 with MTF always on
 */

export interface StochV06Tweak2_211Params extends StrategyParams {
  k_period: number;
  d_period: number;
  oversold: number;
  overbought: number;
  stop_loss: number;
  risk_percent: number;
  ma_period: number;
  mtf_fast_period: number;
  mtf_slow_period: number;
}

const defaultParams: StochV06Tweak2_211Params = {
  k_period: 8,
  d_period: 3,
  oversold: 20,
  overbought: 80,
  stop_loss: 0.04,
  risk_percent: 0.20,
  ma_period: 30,
  mtf_fast_period: 5,
  mtf_slow_period: 14,
};

function loadSavedParams(): Partial<StochV06Tweak2_211Params> | null {
  const paramsPath = path.join(__dirname, 'strat_stoch_v06_tweak2_211.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<StochV06Tweak2_211Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof StochV06Tweak2_211Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

interface TokenData {
  priceHistory: number[];
  kValues: number[];
  fastKValues: number[];
  slowKValues: number[];
  maValues: number[];
}

export class StochV06Tweak2_211Strategy implements Strategy {
  params: StochV06Tweak2_211Params;
  private tokenData: Map<string, TokenData> = new Map();
  private entryPrice: Map<string, number> = new Map();

  constructor(params: Partial<StochV06Tweak2_211Params> = {}) {
    const savedParams = loadSavedParams() || {};
    this.params = { ...defaultParams, ...savedParams, ...params } as StochV06Tweak2_211Params;
    this.params.k_period = Math.max(3, Math.floor(this.params.k_period));
    this.params.d_period = Math.max(2, Math.floor(this.params.d_period));
    this.params.ma_period = Math.max(5, Math.floor(this.params.ma_period));
  }

  onInit(_ctx: BacktestContext): void {}

  private getOrCreateTokenData(tokenId: string): TokenData {
    if (!this.tokenData.has(tokenId)) {
      this.tokenData.set(tokenId, {
        priceHistory: [],
        kValues: [],
        fastKValues: [],
        slowKValues: [],
        maValues: [],
      });
    }
    return this.tokenData.get(tokenId)!;
  }

  private calculateStochastic(priceHistory: number[], period: number): number | null {
    if (priceHistory.length < period) return null;
    const slice = priceHistory.slice(-period);
    const high = Math.max(...slice);
    const low = Math.min(...slice);
    if (high === low) return 50;
    return ((priceHistory[priceHistory.length - 1] - low) / (high - low)) * 100;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const data = this.getOrCreateTokenData(bar.tokenId);
    data.priceHistory.push(bar.close);

    const maxPeriod = Math.max(this.params.k_period, this.params.ma_period, this.params.mtf_slow_period);
    if (data.priceHistory.length > maxPeriod + 10) data.priceHistory.shift();

    // Calculate main stochastic
    const k = this.calculateStochastic(data.priceHistory, this.params.k_period);
    if (k === null) return;

    data.kValues.push(k);
    if (data.kValues.length > this.params.d_period) data.kValues.shift();
    if (data.kValues.length < this.params.d_period) return;

    const d = data.kValues.reduce((a, b) => a + b, 0) / data.kValues.length;

    // Calculate MTF stochastics
    const fastK = this.calculateStochastic(data.priceHistory, this.params.mtf_fast_period);
    const slowK = this.calculateStochastic(data.priceHistory, this.params.mtf_slow_period);

    if (fastK !== null) {
      data.fastKValues.push(fastK);
      if (data.fastKValues.length > 3) data.fastKValues.shift();
    }
    if (slowK !== null) {
      data.slowKValues.push(slowK);
      if (data.slowKValues.length > 3) data.slowKValues.shift();
    }

    // Calculate MA for trend
    if (data.priceHistory.length >= this.params.ma_period) {
      const ma = data.priceHistory.slice(-this.params.ma_period).reduce((a, b) => a + b, 0) / this.params.ma_period;
      data.maValues.push(ma);
      if (data.maValues.length > 5) data.maValues.shift();
    }

    const position = ctx.getPosition(bar.tokenId);

    // MTF confirmation: both fast and slow stochastics should agree
    const mtfBullish = data.fastKValues.length > 0 && data.slowKValues.length > 0 &&
      data.fastKValues[data.fastKValues.length - 1] > data.slowKValues[data.slowKValues.length - 1];
    
    // Trend filter: price above MA
    const trendUp = data.maValues.length > 0 && bar.close > data.maValues[data.maValues.length - 1];

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          return;
        }
        if (k >= this.params.overbought && k < d) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: oversold, K crossing above D, MTF bullish, trend up
      if (k <= this.params.oversold && k > d && mtfBullish && trendUp) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
