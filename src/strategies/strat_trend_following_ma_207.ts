import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import { SimpleMovingAverage, Indicator } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Adaptive Trend Following Strategy with Multiple MAs and ADX
 * - Uses fast, medium, slow MAs with per-token Maps
 * - Only trades when all three align (bullish: fast > medium > slow)
 * - Uses ADX for trend strength (only trade when ADX > 25)
 * - Enters on pullbacks to medium MA
 */

export interface TrendFollowingMAStrategyParams extends StrategyParams {
  fast_period: number;
  medium_period: number;
  slow_period: number;
  adx_period: number;
  adx_threshold: number;
  pullback_threshold: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
  take_profit_enabled: boolean;
  take_profit: number;
}

const defaultParams: TrendFollowingMAStrategyParams = {
  fast_period: 10,
  medium_period: 25,
  slow_period: 50,
  adx_period: 14,
  adx_threshold: 25,
  pullback_threshold: 0.005,
  stop_loss: 0.03,
  trailing_stop: 0.025,
  risk_percent: 0.15,
  take_profit_enabled: false,
  take_profit: 0.08,
};

class ADX extends Indicator {
  private period: number;
  private highs: number[] = [];
  private lows: number[] = [];
  private closes: number[] = [];
  private prevClose: number | null = null;
  private plusDMValues: number[] = [];
  private minusDMValues: number[] = [];
  private trValues: number[] = [];
  private prevADX: number | null = null;
  private smoothedTR: number = 0;
  private smoothedPlusDM: number = 0;
  private smoothedMinusDM: number = 0;
  private initialized: boolean = false;

  constructor(period: number) {
    super();
    this.period = period;
  }

  update(high: number, low: number, close: number): void {
    this.highs.push(high);
    this.lows.push(low);
    this.closes.push(close);

    if (this.highs.length > this.period + 1) {
      this.highs.shift();
      this.lows.shift();
      this.closes.shift();
    }

    if (this.closes.length < 2) {
      this.prevClose = close;
      return;
    }

    const prevHigh = this.highs[this.highs.length - 2];
    const prevLow = this.lows[this.lows.length - 2];

    const plusDM = high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0;
    const minusDM = prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0;

    const tr = Math.max(
      high - low,
      Math.abs(high - this.prevClose!),
      Math.abs(low - this.prevClose!)
    );

    this.plusDMValues.push(plusDM);
    this.minusDMValues.push(minusDM);
    this.trValues.push(tr);

    if (this.plusDMValues.length > this.period) {
      this.plusDMValues.shift();
      this.minusDMValues.shift();
      this.trValues.shift();
    }

    if (this.plusDMValues.length === this.period && !this.initialized) {
      this.smoothedTR = this.trValues.reduce((a, b) => a + b, 0);
      this.smoothedPlusDM = this.plusDMValues.reduce((a, b) => a + b, 0);
      this.smoothedMinusDM = this.minusDMValues.reduce((a, b) => a + b, 0);
      this.initialized = true;
    } else if (this.initialized) {
      this.smoothedTR = this.smoothedTR - (this.smoothedTR / this.period) + tr;
      this.smoothedPlusDM = this.smoothedPlusDM - (this.smoothedPlusDM / this.period) + plusDM;
      this.smoothedMinusDM = this.smoothedMinusDM - (this.smoothedMinusDM / this.period) + minusDM;
    }

    if (this.initialized && this.smoothedTR > 0) {
      const plusDI = (this.smoothedPlusDM / this.smoothedTR) * 100;
      const minusDI = (this.smoothedMinusDM / this.smoothedTR) * 100;
      const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI + 0.0001) * 100;

      if (this.prevADX === null) {
        this.prevADX = dx;
      } else {
        this.prevADX = ((this.prevADX * (this.period - 1)) + dx) / this.period;
      }

      this.push(this.prevADX);
    }

    this.prevClose = close;
  }
}

function loadSavedParams(): Partial<TrendFollowingMAStrategyParams> | null {
  const paramsPath = path.join(__dirname, 'strat_trend_following_ma_207.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<TrendFollowingMAStrategyParams> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof TrendFollowingMAStrategyParams] = value;
        } else if (typeof value === 'boolean') {
          params[key as keyof TrendFollowingMAStrategyParams] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class TrendFollowingMAStrategy implements Strategy {
  params: TrendFollowingMAStrategyParams;
  private fastMAs: Map<string, SimpleMovingAverage> = new Map();
  private mediumMAs: Map<string, SimpleMovingAverage> = new Map();
  private slowMAs: Map<string, SimpleMovingAverage> = new Map();
  private adxs: Map<string, ADX> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();
  private pullbackTriggered: Map<string, boolean> = new Map();

  constructor(params: Partial<TrendFollowingMAStrategyParams> = {}) {
    const savedParams = loadSavedParams();
    const mergedParams = { ...defaultParams, ...savedParams, ...params };

    const sorted = [
      mergedParams.fast_period,
      mergedParams.medium_period,
      mergedParams.slow_period
    ].sort((a, b) => a - b);

    this.params = {
      fast_period: Math.max(2, Math.floor(sorted[0])),
      medium_period: Math.max(3, Math.floor(sorted[1])),
      slow_period: Math.max(4, Math.floor(sorted[2])),
      adx_period: mergedParams.adx_period,
      adx_threshold: mergedParams.adx_threshold,
      pullback_threshold: mergedParams.pullback_threshold,
      stop_loss: mergedParams.stop_loss,
      trailing_stop: mergedParams.trailing_stop,
      risk_percent: mergedParams.risk_percent,
      take_profit_enabled: mergedParams.take_profit_enabled,
      take_profit: mergedParams.take_profit,
    };
  }

  onInit(_ctx: BacktestContext): void {
    console.log(`TrendFollowingMAStrategy initialized with params:`);
    console.log(`  Fast MA period: ${this.params.fast_period}`);
    console.log(`  Medium MA period: ${this.params.medium_period}`);
    console.log(`  Slow MA period: ${this.params.slow_period}`);
    console.log(`  ADX period: ${this.params.adx_period}`);
    console.log(`  ADX threshold: ${this.params.adx_threshold}`);
    console.log(`  Pullback threshold: ${this.params.pullback_threshold * 100}%`);
    console.log(`  Stop loss: ${this.params.stop_loss * 100}%`);
    console.log(`  Trailing stop: ${this.params.trailing_stop * 100}%`);
    console.log(`  Risk percent: ${this.params.risk_percent * 100}%`);
    console.log(`  Take Profit: ${this.params.take_profit_enabled ? `${this.params.take_profit * 100}%` : 'disabled'}`);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.fastMAs.has(bar.tokenId)) {
      this.fastMAs.set(bar.tokenId, new SimpleMovingAverage(this.params.fast_period));
      this.mediumMAs.set(bar.tokenId, new SimpleMovingAverage(this.params.medium_period));
      this.slowMAs.set(bar.tokenId, new SimpleMovingAverage(this.params.slow_period));
      this.adxs.set(bar.tokenId, new ADX(this.params.adx_period));
      this.pullbackTriggered.set(bar.tokenId, false);
    }

    const fastMA = this.fastMAs.get(bar.tokenId)!;
    const mediumMA = this.mediumMAs.get(bar.tokenId)!;
    const slowMA = this.slowMAs.get(bar.tokenId)!;
    const adx = this.adxs.get(bar.tokenId)!;

    fastMA.update(bar.close);
    mediumMA.update(bar.close);
    slowMA.update(bar.close);
    adx.update(bar.high, bar.low, bar.close);

    const fastVal = fastMA.get(0);
    const mediumVal = mediumMA.get(0);
    const slowVal = slowMA.get(0);
    const adxVal = adx.get(0);

    if (fastVal === undefined || mediumVal === undefined || slowVal === undefined) return;

    const bullishAlignment = fastVal > mediumVal && mediumVal > slowVal;
    const bearishAlignment = fastVal < mediumVal && mediumVal < slowVal;
    const strongTrend = adxVal !== undefined && adxVal > this.params.adx_threshold;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      if (entry) {
        if (bar.close < entry * (1 - this.params.stop_loss)) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Stop loss triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          this.pullbackTriggered.delete(bar.tokenId);
          return;
        }

        const highest = Math.max(this.highestPrice.get(bar.tokenId) ?? entry, bar.close);
        this.highestPrice.set(bar.tokenId, highest);

        if (bar.close < highest * (1 - this.params.trailing_stop) && bar.close > entry) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Trailing stop triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          this.pullbackTriggered.delete(bar.tokenId);
          return;
        }

        if (this.params.take_profit_enabled) {
          const tpPrice = entry * (1 + this.params.take_profit);
          if (bar.close >= tpPrice) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Take profit triggered for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
            ctx.close(bar.tokenId);
            this.entryPrice.delete(bar.tokenId);
            this.highestPrice.delete(bar.tokenId);
            this.pullbackTriggered.delete(bar.tokenId);
            return;
          }
        }

        if (bearishAlignment) {
          console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] Bearish alignment exit for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}`);
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          this.pullbackTriggered.delete(bar.tokenId);
        }
      }
    } else {
      if (bullishAlignment && strongTrend) {
        const distanceToMedium = Math.abs(bar.close - mediumVal) / mediumVal;
        const isNearMediumMA = distanceToMedium <= this.params.pullback_threshold;

        if (isNearMediumMA && bar.close >= mediumVal) {
          const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
          const size = cash / bar.close;

          if (size > 0 && cash <= ctx.getCapital()) {
            console.log(`[${new Date(bar.timestamp * 1000).toISOString()}] BUY signal for ${bar.tokenId.slice(0, 8)}... at ${bar.close.toFixed(4)}, size: ${size.toFixed(4)}, ADX: ${adxVal?.toFixed(2) ?? 'N/A'}`);

            const result = ctx.buy(bar.tokenId, size);
            if (result.success) {
              this.entryPrice.set(bar.tokenId, bar.close);
              this.highestPrice.set(bar.tokenId, bar.close);
              this.pullbackTriggered.set(bar.tokenId, true);
            } else {
              console.error(`  Order failed: ${result.error}`);
            }
          }
        }
      }
    }
  }

  onComplete(ctx: BacktestContext): void {
    console.log('\nStrategy completed.');
    const positions = ctx.portfolio.getAllPositions();
    if (positions.length > 0) {
      console.log(`Open positions: ${positions.length}`);
      for (const pos of positions) {
        console.log(`  ${pos.tokenId.slice(0, 8)}...: ${pos.size.toFixed(4)} @ ${pos.avgPrice.toFixed(4)}`);
      }
    }
  }
}
