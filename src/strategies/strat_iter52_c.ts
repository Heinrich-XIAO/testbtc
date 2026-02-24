import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
};

function loadSavedParams<T extends StrategyParams>(fileName: string): Partial<T> | null {
  const paramsPath = path.join(__dirname, fileName);
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function capPush(values: number[], value: number, max = 700): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const sqDiffs = values.map(v => (v - m) * (v - m));
  return Math.sqrt(sqDiffs.reduce((s, v) => s + v, 0) / values.length);
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return 50;
  return ((closes[closes.length - 1] - l) / (h - l)) * 100;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function computeMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  return mean(closes.slice(-period));
}

export interface StratIter52CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  swarm_periods: string;
  spread_entry_threshold: number;
  spread_exit_multiplier: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter52CStrategy implements Strategy {
  params: StratIter52CParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private entrySpread: Map<string, number> = new Map();

  constructor(params: Partial<StratIter52CParams> = {}) {
    const saved = loadSavedParams<StratIter52CParams>('strat_iter52_c.params.json');
    this.params = {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      swarm_periods: '5,10,15,20,25,30',
      spread_entry_threshold: 0.015,
      spread_exit_multiplier: 2.0,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter52CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], opens: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.opens, bar.open);
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
    const cash = ctx.getCapital() * riskPercent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (result.success) {
      this.entryPrice.set(bar.tokenId, bar.close);
      this.entryBar.set(bar.tokenId, barNum);
      return true;
    }
    return false;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.entrySpread.delete(tokenId);
  }

  private getSwarmPeriods(): number[] {
    return this.params.swarm_periods.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
  }

  private computeSwarm(closes: number[]): { centroid: number; spread: number; mas: number[] } | null {
    const periods = this.getSwarmPeriods();
    const mas: number[] = [];
    for (const p of periods) {
      const ma = computeMA(closes, p);
      if (ma === null) return null;
      mas.push(ma);
    }
    const centroid = mean(mas);
    const spread = stdDev(mas) / centroid;
    return { centroid, spread, mas };
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    const swarm = this.computeSwarm(series.closes);

    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      const entrySpread = this.entrySpread.get(bar.tokenId) || this.params.spread_entry_threshold;

      const stopLossHit = bar.low <= e * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= e * (1 + this.params.profit_target);
      const resistanceHit = sr !== null && bar.high >= sr.resistance * 0.98;
      const maxHoldReached = barNum - eb >= this.params.max_hold_bars;
      const swarmDispersed = swarm !== null && swarm.spread > entrySpread * this.params.spread_exit_multiplier;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || swarmDispersed) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (!swarm || !sr || shouldSkipPrice(bar.close)) return;

    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k === null) return;

    const swarmConverged = swarm.spread < this.params.spread_entry_threshold;
    const priceBelowCentroid = bar.close < swarm.centroid;
    const stochOversold = k < this.params.stoch_oversold;

    if (swarmConverged && priceBelowCentroid && stochOversold) {
      if (this.open(ctx, bar, barNum, this.params.risk_percent)) {
        this.entrySpread.set(bar.tokenId, swarm.spread);
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
