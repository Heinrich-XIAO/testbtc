import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
};

type PatternRecord = {
  pattern: number[];
  futureReturn: number;
  tokenId: string;
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

function capPush(values: number[], value: number, max = 500): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function normalizePattern(closes: number[], patternLength: number): number[] | null {
  if (closes.length < patternLength) return null;
  const slice = closes.slice(-patternLength);
  const base = slice[0];
  if (base === 0) return null;
  return slice.map(c => (c - base) / base);
}

function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

function findNearestNeighbors(
  currentPattern: number[],
  history: PatternRecord[],
  k: number,
  maxDistance: number
): PatternRecord[] {
  const distances: { record: PatternRecord; dist: number }[] = [];
  for (const record of history) {
    const dist = euclideanDistance(currentPattern, record.pattern);
    if (dist <= maxDistance) {
      distances.push({ record, dist });
    }
  }
  distances.sort((a, b) => a.dist - b.dist);
  return distances.slice(0, k).map(d => d.record);
}

function calculateSuccessRate(neighbors: PatternRecord[]): number {
  if (neighbors.length === 0) return 0;
  const successful = neighbors.filter(n => n.futureReturn > 0).length;
  return successful / neighbors.length;
}

function calculateAvgReturn(neighbors: PatternRecord[]): number {
  if (neighbors.length === 0) return 0;
  return neighbors.reduce((sum, n) => sum + n.futureReturn, 0) / neighbors.length;
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

abstract class BaseIterStrategy<P extends StrategyParams> implements Strategy {
  params: P;
  protected series: Map<string, TokenSeries> = new Map();
  protected bars: Map<string, number> = new Map();
  protected entryPrice: Map<string, number> = new Map();
  protected entryBar: Map<string, number> = new Map();

  constructor(fileName: string, defaults: P, params: Partial<P>) {
    const saved = loadSavedParams<P>(fileName);
    this.params = { ...defaults, ...saved, ...params } as P;
  }

  onInit(_ctx: BacktestContext): void {}

  protected nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [] });
      this.bars.set(bar.tokenId, 0);
    }
    const s = this.series.get(bar.tokenId)!;
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  protected open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
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

  protected close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter90DParams extends StrategyParams {
  pattern_length: number;
  lookahead_bars: number;
  min_success_rate: number;
  min_avg_return: number;
  k_neighbors: number;
  max_distance: number;
  warmup_bars: number;
  min_history: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter90DStrategy extends BaseIterStrategy<StratIter90DParams> {
  private patternHistory: PatternRecord[] = [];
  private pendingPatterns: Map<string, { pattern: number[]; entryBar: number; tokenId: string }[]> = new Map();

  constructor(params: Partial<StratIter90DParams> = {}) {
    super('strat_iter90_d.params.json', {
      pattern_length: 8,
      lookahead_bars: 10,
      min_success_rate: 0.55,
      min_avg_return: 0.02,
      k_neighbors: 15,
      max_distance: 0.15,
      warmup_bars: 30,
      min_history: 50,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
    }, params);
  }

  private recordPatternOutcomes(bar: Bar, series: TokenSeries): void {
    if (!this.pendingPatterns.has(bar.tokenId)) {
      this.pendingPatterns.set(bar.tokenId, []);
    }
    const pending = this.pendingPatterns.get(bar.tokenId)!;
    const currentBar = this.bars.get(bar.tokenId) || 0;

    const resolved: { pattern: number[]; futureReturn: number; tokenId: string }[] = [];
    const stillPending: { pattern: number[]; entryBar: number; tokenId: string }[] = [];

    for (const p of pending) {
      const barsSinceEntry = currentBar - p.entryBar;
      if (barsSinceEntry >= this.params.lookahead_bars) {
        const closes = series.closes;
        if (closes.length > this.params.lookahead_bars) {
          const futureClose = closes[closes.length - 1];
          const entryClose = closes[closes.length - 1 - barsSinceEntry];
          if (entryClose > 0) {
            const futureReturn = (futureClose - entryClose) / entryClose;
            resolved.push({
              pattern: p.pattern,
              futureReturn,
              tokenId: p.tokenId
            });
          }
        }
      } else {
        stillPending.push(p);
      }
    }

    this.pendingPatterns.set(bar.tokenId, stillPending);

    for (const r of resolved) {
      this.patternHistory.push(r);
      if (this.patternHistory.length > 5000) {
        this.patternHistory.shift();
      }
    }
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);

    this.recordPatternOutcomes(bar, series);

    const currentPattern = normalizePattern(series.closes, this.params.pattern_length);

    if (currentPattern) {
      if (!this.pendingPatterns.has(bar.tokenId)) {
        this.pendingPatterns.set(bar.tokenId, []);
      }
      this.pendingPatterns.get(bar.tokenId)!.push({
        pattern: currentPattern,
        entryBar: barNum,
        tokenId: bar.tokenId
      });
    }

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !currentPattern) return;
    if (barNum < this.params.warmup_bars) return;
    if (this.patternHistory.length < this.params.min_history) return;

    const neighbors = findNearestNeighbors(
      currentPattern,
      this.patternHistory,
      this.params.k_neighbors,
      this.params.max_distance
    );

    if (neighbors.length < 3) return;

    const successRate = calculateSuccessRate(neighbors);
    const avgReturn = calculateAvgReturn(neighbors);

    if (successRate >= this.params.min_success_rate && avgReturn >= this.params.min_avg_return) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
