import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
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

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
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

function binaryEntropy(bits: number[]): number {
  if (bits.length === 0) return 0;
  const ones = bits.reduce((sum, b) => sum + b, 0);
  const p = ones / bits.length;
  if (p <= 1e-9 || p >= 1 - 1e-9) return 0;
  const h = -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
  return h;
}

function buildReturnCells(closes: number[], window: number): number[] | null {
  if (closes.length < window + 1) return null;
  const cells: number[] = [];
  const start = closes.length - (window + 1);
  for (let i = start + 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const next = closes[i];
    cells.push(next >= prev ? 1 : 0);
  }
  return cells;
}

function evolveRule30Like(cells: number[]): number[] {
  const n = cells.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const left = cells[(i - 1 + n) % n];
    const center = cells[i];
    const right = cells[(i + 1) % n];
    out[i] = left ^ (center | right);
  }
  return out;
}

function transitionRatio(bits: number[]): number {
  if (bits.length < 2) return 0;
  let transitions = 0;
  for (let i = 1; i < bits.length; i++) {
    if (bits[i] !== bits[i - 1]) transitions += 1;
  }
  if (bits[0] !== bits[bits.length - 1]) transitions += 1;
  return transitions / bits.length;
}

function noveltyRatio(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let diff = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) diff += 1;
  }
  return diff / n;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function complexityScore(cells: number[]): number {
  const evolved = evolveRule30Like(cells);
  const entropy = binaryEntropy(evolved);
  const transitions = transitionRatio(evolved);
  const novelty = noveltyRatio(cells, evolved);
  return clamp01(0.42 * entropy + 0.33 * transitions + 0.25 * novelty);
}

export interface StratIter54AParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  support_buffer: number;
  ca_window: number;
  ca_emergence_min: number;
  ca_emergence_max: number;
  ca_impulse_min: number;
  ca_collapse_threshold: number;
  ca_collapse_delta: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter54AStrategy implements Strategy {
  params: StratIter54AParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private prevComplexity: Map<string, number> = new Map();

  constructor(params: Partial<StratIter54AParams> = {}) {
    const saved = loadSavedParams<StratIter54AParams>('strat_iter54_a.params.json');
    this.params = {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      support_buffer: 0.015,
      ca_window: 31,
      ca_emergence_min: 0.58,
      ca_emergence_max: 0.88,
      ca_impulse_min: 0.03,
      ca_collapse_threshold: 0.44,
      ca_collapse_delta: 0.09,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter54AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
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

  private open(ctx: BacktestContext, bar: Bar, barNum: number): boolean {
    const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;

    const result = ctx.buy(bar.tokenId, size);
    if (!result.success) return false;

    this.entryPrice.set(bar.tokenId, bar.close);
    this.entryBar.set(bar.tokenId, barNum);
    return true;
  }

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (!sr || shouldSkipPrice(bar.close)) return;

    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    const cells = buildReturnCells(series.closes, this.params.ca_window);
    if (k === null || cells === null) return;

    const score = complexityScore(cells);
    const prevScore = this.prevComplexity.get(bar.tokenId);
    this.prevComplexity.set(bar.tokenId, score);

    const collapse =
      score <= this.params.ca_collapse_threshold ||
      (prevScore !== undefined && prevScore - score >= this.params.ca_collapse_delta);

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * 0.98;
      const maxHoldReached = barNum - entryBar >= this.params.max_hold_bars;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || collapse) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (prevScore === undefined) return;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochSupport = k <= this.params.stoch_oversold;
    const emergentBand = score >= this.params.ca_emergence_min && score <= this.params.ca_emergence_max;
    const impulse = score - prevScore >= this.params.ca_impulse_min;

    if (nearSupport && stochSupport && emergentBand && impulse) {
      this.open(ctx, bar, barNum);
    }
  }
}
