import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  phaseX: number[];
  phaseY: number[];
  curvatures: number[];
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

function trajectoryCurvature(phaseX: number[], phaseY: number[]): number | null {
  if (phaseX.length < 3 || phaseY.length < 3) return null;

  const i = phaseX.length - 1;
  const x0 = phaseX[i - 2];
  const y0 = phaseY[i - 2];
  const x1 = phaseX[i - 1];
  const y1 = phaseY[i - 1];
  const x2 = phaseX[i];
  const y2 = phaseY[i];

  const v1x = x1 - x0;
  const v1y = y1 - y0;
  const v2x = x2 - x1;
  const v2y = y2 - y1;

  const n1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const n2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (n1 <= 1e-9 || n2 <= 1e-9) return 0;

  const cross = v1x * v2y - v1y * v2x;
  return cross / (n1 * n2 + 1e-9);
}

function momentum(closes: number[], lookback: number): number | null {
  const lb = Math.max(1, Math.floor(lookback));
  if (closes.length < lb + 1) return null;
  const now = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - lb];
  if (prev <= 0) return null;
  return (now - prev) / prev;
}

export interface StratIter59AParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  momentum_lookback: number;
  momentum_floor: number;
  cusp_min_negative_curvature: number;
  cusp_positive_curvature: number;
  min_curvature_jump: number;
  max_cusp_lookback_bars: number;
  adverse_curvature_threshold: number;
  adverse_curvature_accel: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter59AStrategy implements Strategy {
  params: StratIter59AParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private lastCuspBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter59AParams> = {}) {
    const saved = loadSavedParams<StratIter59AParams>('strat_iter59_a.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.006,
      momentum_lookback: 3,
      momentum_floor: 0.001,
      cusp_min_negative_curvature: 0.22,
      cusp_positive_curvature: 0.04,
      min_curvature_jump: 0.20,
      max_cusp_lookback_bars: 3,
      adverse_curvature_threshold: -0.18,
      adverse_curvature_accel: 0.07,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter59AParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], phaseX: [], phaseY: [], curvatures: [] });
      this.bars.set(bar.tokenId, 0);
    }

    const s = this.series.get(bar.tokenId)!;
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    const dPrice = prevClose && prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;
    const mom = momentum(s.closes, this.params.momentum_lookback) ?? 0;
    capPush(s.phaseX, dPrice);
    capPush(s.phaseY, mom);

    const kappa = trajectoryCurvature(s.phaseX, s.phaseY);
    if (kappa !== null) {
      capPush(s.curvatures, kappa);
    }

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
    if (shouldSkipPrice(bar.close)) return;

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    if (!sr || series.curvatures.length < 2) return;

    const pos = ctx.getPosition(bar.tokenId);
    const currCurvature = series.curvatures[series.curvatures.length - 1];
    const prevCurvature = series.curvatures[series.curvatures.length - 2];
    const curvatureDelta = currCurvature - prevCurvature;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const reclaimedSupport = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);
    const phaseMomentum = series.phaseY.length > 0 ? series.phaseY[series.phaseY.length - 1] : 0;

    const reversalCusp =
      prevCurvature <= -this.params.cusp_min_negative_curvature &&
      currCurvature >= this.params.cusp_positive_curvature &&
      curvatureDelta >= this.params.min_curvature_jump;

    if (reversalCusp) {
      this.lastCuspBar.set(bar.tokenId, barNum);
    }

    const cuspBar = this.lastCuspBar.get(bar.tokenId);
    const cuspIsFresh = cuspBar !== undefined && barNum - cuspBar <= Math.max(1, Math.floor(this.params.max_cusp_lookback_bars));

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;

      const curvatureAgainstPosition =
        currCurvature <= this.params.adverse_curvature_threshold &&
        curvatureDelta <= -this.params.adverse_curvature_accel;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || curvatureAgainstPosition) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const validEntry = nearSupport && reclaimedSupport && cuspIsFresh && phaseMomentum >= this.params.momentum_floor;
    if (validEntry) {
      this.open(ctx, bar, barNum);
    }
  }
}
