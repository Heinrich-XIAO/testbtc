import type { Strategy, BacktestContext, Bar, StrategyParams } from '../types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Velocity Strategy 222
 * - Measures rate of price change (velocity)
 * - Enters when velocity accelerates
 */

export interface Velocity222Params extends StrategyParams {
  velocity_period: number;
  acceleration_period: number;
  velocity_threshold: number;
  acceleration_threshold: number;
  stop_loss: number;
  trailing_stop: number;
  risk_percent: number;
}

const defaultParams: Velocity222Params = {
  velocity_period: 5,
  acceleration_period: 3,
  velocity_threshold: 0.015,
  acceleration_threshold: 0.005,
  stop_loss: 0.05,
  trailing_stop: 0.03,
  risk_percent: 0.15,
};

function loadSavedParams(): Partial<Velocity222Params> | null {
  const paramsPath = path.join(__dirname, 'strat_velocity_222.params.json');
  if (!fs.existsSync(paramsPath)) return null;

  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    const saved = JSON.parse(content);
    const params: Partial<Velocity222Params> = {};

    for (const [key, value] of Object.entries(saved)) {
      if (key !== 'metadata' && key in defaultParams) {
        if (typeof value === 'number') {
          params[key as keyof Velocity222Params] = value;
        }
      }
    }

    return params;
  } catch {
    return null;
  }
}

export class Velocity222Strategy implements Strategy {
  params: Velocity222Params;
  private priceHistory: Map<string, number[]> = new Map();
  private velocityHistory: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private highestPrice: Map<string, number> = new Map();

  constructor(params: Partial<Velocity222Params> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as Velocity222Params;
  }

  onInit(_ctx: BacktestContext): void {}

  private getVelocity(history: number[]): number {
    if (history.length < this.params.velocity_period + 1) return 0;
    const current = history[history.length - 1];
    const past = history[history.length - 1 - this.params.velocity_period];
    return (current - past) / past / this.params.velocity_period;
  }

  private getAcceleration(velocities: number[]): number {
    if (velocities.length < this.params.acceleration_period + 1) return 0;
    const current = velocities[velocities.length - 1];
    const past = velocities[velocities.length - 1 - this.params.acceleration_period];
    return current - past;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.priceHistory.has(bar.tokenId)) {
      this.priceHistory.set(bar.tokenId, []);
      this.velocityHistory.set(bar.tokenId, []);
    }

    const history = this.priceHistory.get(bar.tokenId)!;
    const velocities = this.velocityHistory.get(bar.tokenId)!;

    history.push(bar.close);
    const maxPeriod = this.params.velocity_period + this.params.acceleration_period + 10;
    if (history.length > maxPeriod) history.shift();

    const velocity = this.getVelocity(history);
    velocities.push(velocity);
    if (velocities.length > this.params.acceleration_period + 5) velocities.shift();

    const acceleration = this.getAcceleration(velocities);

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const highest = this.highestPrice.get(bar.tokenId) ?? bar.close;

      if (entry) {
        if (bar.close > highest) {
          this.highestPrice.set(bar.tokenId, bar.close);
        }
        const newHighest = this.highestPrice.get(bar.tokenId)!;

        if (bar.close < entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        if (bar.close < newHighest * (1 - this.params.trailing_stop)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
          return;
        }

        // Exit on deceleration
        if (acceleration < -this.params.acceleration_threshold) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.highestPrice.delete(bar.tokenId);
        }
      }
    } else if (bar.close > 0.05 && bar.close < 0.95) {
      // Entry: positive velocity with positive acceleration
      if (velocity > this.params.velocity_threshold && acceleration > this.params.acceleration_threshold) {
        const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
        const size = cash / bar.close;
        if (size > 0 && cash <= ctx.getCapital()) {
          const result = ctx.buy(bar.tokenId, size);
          if (result.success) {
            this.entryPrice.set(bar.tokenId, bar.close);
            this.highestPrice.set(bar.tokenId, bar.close);
          }
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
