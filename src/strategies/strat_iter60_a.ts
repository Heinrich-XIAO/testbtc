import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type PendingObservation = {
  motif: string;
  entryPrice: number;
  barNum: number;
};

type MotifStats = {
  bullish: number;
  bearish: number;
};

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  supportTouches: number[];
  pending: PendingObservation[];
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

function zNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  const std = Math.sqrt(Math.max(0, variance));
  if (std <= 1e-8) return values.map(() => 0);
  return values.map((v) => (v - mean) / std);
}

function paa(values: number[], segments: number): number[] {
  const n = values.length;
  const s = Math.max(1, Math.floor(segments));
  const out: number[] = [];
  for (let i = 0; i < s; i++) {
    const start = Math.floor((i * n) / s);
    const end = Math.max(start + 1, Math.floor(((i + 1) * n) / s));
    const slice = values.slice(start, Math.min(n, end));
    const avg = slice.reduce((acc, v) => acc + v, 0) / slice.length;
    out.push(avg);
  }
  return out;
}

function breakpoints(alphabetSize: number): number[] {
  const bp: Record<number, number[]> = {
    3: [-0.43, 0.43],
    4: [-0.67, 0, 0.67],
    5: [-0.84, -0.25, 0.25, 0.84],
    6: [-0.97, -0.43, 0, 0.43, 0.97],
    7: [-1.07, -0.57, -0.18, 0.18, 0.57, 1.07],
  };
  const clamped = Math.max(3, Math.min(7, Math.floor(alphabetSize)));
  return bp[clamped];
}

function saxEncode(values: number[], alphabetSize: number): string {
  const bp = breakpoints(alphabetSize);
  const chars = 'abcdefg';
  return values
    .map((v) => {
      let bucket = 0;
      while (bucket < bp.length && v > bp[bucket]) bucket++;
      return chars[bucket];
    })
    .join('');
}

export interface StratIter60AParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  support_touch_lookback: number;
  min_support_touches: number;
  sax_window: number;
  paa_segments: number;
  alphabet_size: number;
  motif_horizon: number;
  bullish_return_threshold: number;
  bearish_return_threshold: number;
  motif_min_samples: number;
  bullish_precision_min: number;
  bearish_precision_min: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter60AStrategy implements Strategy {
  params: StratIter60AParams;

  private series: Map<string, TokenSeries> = new Map();
  private motifStatsByToken: Map<string, Map<string, MotifStats>> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter60AParams> = {}) {
    const saved = loadSavedParams<StratIter60AParams>('strat_iter60_a.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      support_touch_lookback: 16,
      min_support_touches: 2,
      sax_window: 18,
      paa_segments: 6,
      alphabet_size: 5,
      motif_horizon: 8,
      bullish_return_threshold: 0.01,
      bearish_return_threshold: 0.01,
      motif_min_samples: 3,
      bullish_precision_min: 0.62,
      bearish_precision_min: 0.62,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter60AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private getTokenSeries(tokenId: string): TokenSeries {
    if (!this.series.has(tokenId)) {
      this.series.set(tokenId, { closes: [], highs: [], lows: [], supportTouches: [], pending: [] });
      this.bars.set(tokenId, 0);
    }
    return this.series.get(tokenId)!;
  }

  private getTokenMotifs(tokenId: string): Map<string, MotifStats> {
    if (!this.motifStatsByToken.has(tokenId)) {
      this.motifStatsByToken.set(tokenId, new Map());
    }
    return this.motifStatsByToken.get(tokenId)!;
  }

  private buildMotif(closes: number[]): string | null {
    const window = Math.max(8, Math.floor(this.params.sax_window));
    const segments = Math.max(3, Math.floor(this.params.paa_segments));
    if (closes.length < window || segments > window) return null;
    const slice = closes.slice(-window);
    const normalized = zNormalize(slice);
    const compressed = paa(normalized, segments);
    return saxEncode(compressed, this.params.alphabet_size);
  }

  private updateMotifDictionary(tokenId: string, s: TokenSeries, barNum: number, close: number): string | null {
    const motif = this.buildMotif(s.closes);
    if (!motif) return null;

    s.pending.push({ motif, entryPrice: close, barNum });
    if (s.pending.length > 500) s.pending.shift();

    const horizon = Math.max(2, Math.floor(this.params.motif_horizon));
    const motifMap = this.getTokenMotifs(tokenId);
    const keep: PendingObservation[] = [];

    for (const obs of s.pending) {
      if (barNum - obs.barNum < horizon) {
        keep.push(obs);
        continue;
      }
      if (obs.entryPrice <= 0) continue;
      const fwd = (close - obs.entryPrice) / obs.entryPrice;
      let stats = motifMap.get(obs.motif);
      if (!stats) {
        stats = { bullish: 0, bearish: 0 };
        motifMap.set(obs.motif, stats);
      }
      if (fwd >= this.params.bullish_return_threshold) stats.bullish++;
      if (fwd <= -this.params.bearish_return_threshold) stats.bearish++;
    }

    s.pending = keep;
    return motif;
  }

  private motifSignal(tokenId: string, motif: string): 'bullish' | 'bearish' | 'neutral' {
    const stats = this.getTokenMotifs(tokenId).get(motif);
    if (!stats) return 'neutral';

    const total = stats.bullish + stats.bearish;
    if (total < Math.max(1, Math.floor(this.params.motif_min_samples))) return 'neutral';

    const bullRatio = stats.bullish / total;
    const bearRatio = stats.bearish / total;
    if (bullRatio >= this.params.bullish_precision_min && stats.bullish > stats.bearish) return 'bullish';
    if (bearRatio >= this.params.bearish_precision_min && stats.bearish > stats.bullish) return 'bearish';
    return 'neutral';
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
    const s = this.getTokenSeries(bar.tokenId);
    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);

    if (shouldSkipPrice(bar.close)) return;

    const sr = priorSupportResistance(s.highs, s.lows, this.params.sr_lookback);
    if (!sr) return;

    const motif = this.updateMotifDictionary(bar.tokenId, s, barNum, bar.close);
    if (!motif) return;
    const motifClass = this.motifSignal(bar.tokenId, motif);

    const touchedSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    if (touchedSupport) capPush(s.supportTouches, barNum, 200);

    const touchLookback = Math.max(2, Math.floor(this.params.support_touch_lookback));
    const touches = s.supportTouches.filter((b) => barNum - b <= touchLookback).length;
    const supportConfirmed =
      touches >= Math.max(1, Math.floor(this.params.min_support_touches)) &&
      touchedSupport &&
      bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
      const motifFlipBearish = motifClass === 'bearish';

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || motifFlipBearish) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (motifClass === 'bullish' && supportConfirmed) {
      this.open(ctx, bar, barNum);
    }
  }
}
