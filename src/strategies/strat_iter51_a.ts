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

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return 50;
  return ((closes[closes.length - 1] - l) / (h - l)) * 100;
}

function rsi(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

function atr(highs: number[], lows: number[], closes: number[], period: number): number | null {
  if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = highs.length - period; i < highs.length; i++) {
    const prevClose = closes[i - 1];
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - prevClose), Math.abs(lows[i] - prevClose));
    trs.push(tr);
  }
  return mean(trs);
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

export interface StratIter51AParams extends StrategyParams {
  sr_lookback: number;
  rsi_period: number;
  rsi_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  ma_period: number;
  atr_period: number;
  atr_ratio_max: number;
  momentum_lookback: number;
  momentum_threshold: number;
  gene_rsi_weight: number;
  gene_stoch_weight: number;
  gene_ma_weight: number;
  gene_atr_weight: number;
  gene_momentum_weight: number;
  fitness_threshold: number;
  exit_fitness_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter51AStrategy implements Strategy {
  params: StratIter51AParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private entryFitness: Map<string, number> = new Map();

  constructor(params: Partial<StratIter51AParams> = {}) {
    const saved = loadSavedParams<StratIter51AParams>('strat_iter51_a.params.json');
    this.params = {
      sr_lookback: 50,
      rsi_period: 14,
      rsi_threshold: 35,
      stoch_k_period: 14,
      stoch_oversold: 20,
      ma_period: 20,
      atr_period: 14,
      atr_ratio_max: 0.85,
      momentum_lookback: 3,
      momentum_threshold: 0.005,
      gene_rsi_weight: 1.0,
      gene_stoch_weight: 1.2,
      gene_ma_weight: 0.8,
      gene_atr_weight: 0.6,
      gene_momentum_weight: 0.9,
      fitness_threshold: 2.5,
      exit_fitness_threshold: 1.5,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter51AParams;
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

  private open(ctx: BacktestContext, bar: Bar, barNum: number, fitness: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (result.success) {
      this.entryPrice.set(bar.tokenId, bar.close);
      this.entryBar.set(bar.tokenId, barNum);
      this.entryFitness.set(bar.tokenId, fitness);
      return true;
    }
    return false;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.entryFitness.delete(tokenId);
  }

  private computeFitness(series: TokenSeries): number {
    const rsiVal = rsi(series.closes, this.params.rsi_period);
    const stochVal = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    const maVal = sma(series.closes, this.params.ma_period);
    const atrVal = atr(series.highs, series.lows, series.closes, this.params.atr_period);
    const close = series.closes[series.closes.length - 1];

    let fitness = 0;

    if (rsiVal !== null && rsiVal < this.params.rsi_threshold) {
      fitness += this.params.gene_rsi_weight * (this.params.rsi_threshold - rsiVal) / this.params.rsi_threshold;
    }

    if (stochVal !== null && stochVal < this.params.stoch_oversold) {
      fitness += this.params.gene_stoch_weight * (this.params.stoch_oversold - stochVal) / this.params.stoch_oversold;
    }

    if (maVal !== null && close < maVal) {
      fitness += this.params.gene_ma_weight * Math.min(1, (maVal - close) / maVal / 0.05);
    }

    if (atrVal !== null && series.closes.length >= this.params.atr_period * 2) {
      const historicalAtr = atr(series.highs.slice(0, -this.params.atr_period), 
                                 series.lows.slice(0, -this.params.atr_period), 
                                 series.closes.slice(0, -this.params.atr_period), 
                                 this.params.atr_period);
      if (historicalAtr !== null && historicalAtr > 1e-8) {
        const atrRatio = atrVal / historicalAtr;
        if (atrRatio <= this.params.atr_ratio_max) {
          fitness += this.params.gene_atr_weight * (this.params.atr_ratio_max - atrRatio) / this.params.atr_ratio_max;
        }
      }
    }

    if (series.closes.length >= this.params.momentum_lookback + 1) {
      const prevClose = series.closes[series.closes.length - 1 - this.params.momentum_lookback];
      if (prevClose > 0) {
        const momentum = (close - prevClose) / prevClose;
        if (momentum > this.params.momentum_threshold) {
          fitness += this.params.gene_momentum_weight * Math.min(1, momentum / this.params.momentum_threshold / 2);
        }
      }
    }

    return fitness;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      const currentFitness = this.computeFitness(series);
      const exitNow =
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr !== null && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars ||
        currentFitness < this.params.exit_fitness_threshold;
      if (exitNow) this.close(ctx, bar.tokenId);
      return;
    }

    if (!sr || shouldSkipPrice(bar.close)) return;

    const fitness = this.computeFitness(series);
    const nearSupport = bar.low <= sr.support * 1.02;

    if (fitness >= this.params.fitness_threshold && nearSupport) {
      this.open(ctx, bar, barNum, fitness);
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
