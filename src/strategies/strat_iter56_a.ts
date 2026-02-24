import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

type Extremum = {
  kind: 'peak' | 'trough';
  price: number;
  bornBar: number;
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

function capPush(values: number[], value: number, max = 900): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface StratIter56AParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  stoch_period: number;
  stoch_oversold: number;
  stoch_rebound_delta: number;
  pivot_width: number;
  extrema_invalidation_buffer: number;
  persistence_norm_bars: number;
  max_active_extrema_age: number;
  entry_basin_score: number;
  entry_basin_slope_min: number;
  exit_basin_score: number;
  exit_basin_drop_from_entry: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter56AStrategy implements Strategy {
  params: StratIter56AParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private extrema: Map<string, Extremum[]> = new Map();
  private basinScoreHistory: Map<string, number[]> = new Map();
  private prevStoch: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private entryBasinScore: Map<string, number> = new Map();

  constructor(params: Partial<StratIter56AParams> = {}) {
    const saved = loadSavedParams<StratIter56AParams>('strat_iter56_a.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      stoch_period: 14,
      stoch_oversold: 16,
      stoch_rebound_delta: 5,
      pivot_width: 3,
      extrema_invalidation_buffer: 0.012,
      persistence_norm_bars: 14,
      max_active_extrema_age: 56,
      entry_basin_score: 0.18,
      entry_basin_slope_min: 0.01,
      exit_basin_score: -0.04,
      exit_basin_drop_from_entry: 0.16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter56AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
      this.extrema.set(bar.tokenId, []);
      this.basinScoreHistory.set(bar.tokenId, []);
    }

    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private updateExtrema(tokenId: string, series: TokenSeries, barNum: number): void {
    const w = Math.max(2, Math.round(this.params.pivot_width));
    const centerIdx = series.closes.length - 1 - w;
    const windowStart = centerIdx - w;
    const windowEnd = centerIdx + w;

    if (windowStart < 0 || windowEnd >= series.closes.length) return;

    const windowHighs = series.highs.slice(windowStart, windowEnd + 1);
    const windowLows = series.lows.slice(windowStart, windowEnd + 1);
    const centerHigh = series.highs[centerIdx];
    const centerLow = series.lows[centerIdx];

    const isPeak = centerHigh >= Math.max(...windowHighs);
    const isTrough = centerLow <= Math.min(...windowLows);
    const centerBar = barNum - w;

    if (isPeak || isTrough) {
      const active = this.extrema.get(tokenId) || [];
      const kind: 'peak' | 'trough' = isTrough ? 'trough' : 'peak';
      const price = isTrough ? centerLow : centerHigh;
      active.push({ kind, price, bornBar: centerBar });
      this.extrema.set(tokenId, active.slice(-80));
    }
  }

  private persistenceProxy(tokenId: string, close: number, barNum: number): number {
    const active = this.extrema.get(tokenId) || [];
    const survivors: Extremum[] = [];
    const troughScores: number[] = [];
    const peakScores: number[] = [];

    for (const ex of active) {
      const age = barNum - ex.bornBar;
      if (age < 0 || age > this.params.max_active_extrema_age) continue;

      const broken =
        ex.kind === 'trough'
          ? close <= ex.price * (1 - this.params.extrema_invalidation_buffer)
          : close >= ex.price * (1 + this.params.extrema_invalidation_buffer);

      if (broken) continue;
      survivors.push(ex);

      const ageNorm = clamp(age / this.params.persistence_norm_bars, 0, 1.75);
      if (ex.kind === 'trough') troughScores.push(ageNorm);
      else peakScores.push(ageNorm);
    }

    this.extrema.set(tokenId, survivors.slice(-80));

    const troughPersistence = avg(troughScores);
    const peakPersistence = avg(peakScores);
    return troughPersistence - 0.85 * peakPersistence;
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number, basinScore: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;

    const result = ctx.buy(bar.tokenId, size);
    if (!result.success) return false;

    this.entryPrice.set(bar.tokenId, bar.close);
    this.entryBar.set(bar.tokenId, barNum);
    this.entryBasinScore.set(bar.tokenId, basinScore);
    return true;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
    this.entryBasinScore.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (!sr || shouldSkipPrice(bar.close)) return;

    this.updateExtrema(bar.tokenId, series, barNum);
    const basinScore = this.persistenceProxy(bar.tokenId, bar.close, barNum);

    const history = this.basinScoreHistory.get(bar.tokenId) || [];
    const prevBasin = history.length > 0 ? history[history.length - 1] : basinScore;
    capPush(history, basinScore, 120);
    this.basinScoreHistory.set(bar.tokenId, history);
    const basinSlope = basinScore - prevBasin;

    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_period);
    if (k === null) return;
    const prevK = this.prevStoch.get(bar.tokenId);
    this.prevStoch.set(bar.tokenId, k);

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBar = this.entryBar.get(bar.tokenId);
      const entryBasin = this.entryBasinScore.get(bar.tokenId);
      if (entry === undefined || entryBar === undefined || entryBasin === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * 0.985;
      const maxHoldReached = barNum - entryBar >= this.params.max_hold_bars;
      const persistenceCollapsed =
        basinScore <= this.params.exit_basin_score ||
        basinScore <= entryBasin - this.params.exit_basin_drop_from_entry;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || persistenceCollapsed) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (prevK === undefined) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;
    const durableBasin = basinScore >= this.params.entry_basin_score && basinSlope >= this.params.entry_basin_slope_min;

    if (nearSupport && stochRebound && durableBasin) {
      this.open(ctx, bar, barNum, basinScore);
    }
  }
}
