import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface StratIter92DParams extends StrategyParams {
  spline_knots: number;
  spline_smoothing: number;
  derivative_threshold: number;
  min_curvature: number;
  stoch_oversold: number;
  stoch_k_period: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

const defaultParams: StratIter92DParams = {
  spline_knots: 6,
  spline_smoothing: 0.5,
  derivative_threshold: 0.008,
  min_curvature: 0.001,
  stoch_oversold: 16,
  stoch_k_period: 14,
  stop_loss: 0.08,
  profit_target: 0.18,
  max_hold_bars: 28,
  risk_percent: 0.25,
  sr_lookback: 50,
};

function loadSavedParams(): Partial<StratIter92DParams> | null {
  const paramsPath = path.join(__dirname, 'strat_iter92_d.params.json');
  if (!fs.existsSync(paramsPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  } catch {
    return null;
  }
}

function cubicBSpline(x: number, i: number, knots: number[], n: number): number {
  if (n === 0) {
    return (x >= knots[i] && x < knots[i + 1]) ? 1 : 0;
  }
  
  const left = knots[i + n] - knots[i];
  const right = knots[i + n + 1] - knots[i + 1];
  
  let result = 0;
  if (left > 0) {
    result += ((x - knots[i]) / left) * cubicBSpline(x, i, knots, n - 1);
  }
  if (right > 0) {
    result += ((knots[i + n + 1] - x) / right) * cubicBSpline(x, i + 1, knots, n - 1);
  }
  
  return result;
}

function smoothingSpline(closes: number[], numKnots: number, smoothing: number): { derivative: number; curvature: number } | null {
  if (closes.length < numKnots + 2) return null;
  
  const n = closes.length;
  const x: number[] = closes.map((_, i) => i);
  const y: number[] = closes;
  
  const knots: number[] = [];
  const step = n / (numKnots + 1);
  for (let i = 0; i <= numKnots + 3; i++) {
    knots.push(Math.max(0, Math.min(n - 1, i * step - step)));
  }
  
  const designMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j <= numKnots; j++) {
      row.push(cubicBSpline(x[i], j, knots, 3));
    }
    designMatrix.push(row);
  }
  
  const coeffs: number[] = [];
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i <= numKnots; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += designMatrix[j][i] * y[j] * smoothing;
    }
    coeffs.push(sum / (smoothing * n + 0.001));
  }
  
  const lastIdx = n - 1;
  let derivative = 0;
  let prevDerivative = 0;
  
  for (let j = 0; j <= numKnots; j++) {
    const basisNow = cubicBSpline(x[lastIdx], j, knots, 3);
    const basisPrev = cubicBSpline(x[lastIdx - 1], j, knots, 3);
    derivative += coeffs[j] * basisNow;
    prevDerivative += coeffs[j] * basisPrev;
  }
  
  const trueDerivative = (derivative - prevDerivative);
  const curvature = derivative - 2 * prevDerivative + (n > 2 ? closes[n - 3] : prevDerivative);
  
  return { derivative: trueDerivative / meanY, curvature: curvature / meanY };
}

function stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period) return null;
  const highSlice = highs.slice(-period);
  const lowSlice = lows.slice(-period);
  const highest = Math.max(...highSlice);
  const lowest = Math.min(...lowSlice);
  if (highest === lowest) return 50;
  return ((closes[closes.length - 1] - lowest) / (highest - lowest)) * 100;
}

function supportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function capPush<T>(arr: T[], val: T, max = 500): void {
  arr.push(val);
  if (arr.length > max) arr.shift();
}

export class StratIter92DStrategy implements Strategy {
  params: StratIter92DParams;
  private closes: Map<string, number[]> = new Map();
  private highs: Map<string, number[]> = new Map();
  private lows: Map<string, number[]> = new Map();
  private kValues: Map<string, number[]> = new Map();
  private derivatives: Map<string, number[]> = new Map();
  private curvatures: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private barCount: Map<string, number> = new Map();

  constructor(params: Partial<StratIter92DParams> = {}) {
    const savedParams = loadSavedParams();
    this.params = { ...defaultParams, ...savedParams, ...params } as StratIter92DParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.closes.has(bar.tokenId)) {
      this.closes.set(bar.tokenId, []);
      this.highs.set(bar.tokenId, []);
      this.lows.set(bar.tokenId, []);
      this.kValues.set(bar.tokenId, []);
      this.derivatives.set(bar.tokenId, []);
      this.curvatures.set(bar.tokenId, []);
      this.barCount.set(bar.tokenId, 0);
    }

    const closes = this.closes.get(bar.tokenId)!;
    const highs = this.highs.get(bar.tokenId)!;
    const lows = this.lows.get(bar.tokenId)!;
    const kVals = this.kValues.get(bar.tokenId)!;
    const derivatives = this.derivatives.get(bar.tokenId)!;
    const curvatures = this.curvatures.get(bar.tokenId)!;
    const barNum = (this.barCount.get(bar.tokenId) || 0) + 1;
    this.barCount.set(bar.tokenId, barNum);

    capPush(closes, bar.close);
    capPush(highs, bar.high);
    capPush(lows, bar.low);

    const spline = smoothingSpline(closes, this.params.spline_knots, this.params.spline_smoothing);
    if (spline !== null) {
      capPush(derivatives, spline.derivative);
      capPush(curvatures, spline.curvature);
    }

    const k = stochasticK(closes, highs, lows, this.params.stoch_k_period);
    if (k !== null) {
      capPush(kVals, k);
    }

    const sr = supportResistance(highs, lows, this.params.sr_lookback);
    if (!sr) return;

    const position = ctx.getPosition(bar.tokenId);

    if (position && position.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBarNum = this.entryBar.get(bar.tokenId);
      if (entry !== undefined && entryBarNum !== undefined) {
        if (bar.low <= entry * (1 - this.params.stop_loss)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
        if (bar.high >= entry * (1 + this.params.profit_target)) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
        if (barNum - entryBarNum >= this.params.max_hold_bars) {
          ctx.close(bar.tokenId);
          this.entryPrice.delete(bar.tokenId);
          this.entryBar.delete(bar.tokenId);
          return;
        }
      }
      return;
    }

    if (bar.close <= 0.05 || bar.close >= 0.95) return;
    if (kVals.length < 3 || derivatives.length < 2 || curvatures.length < 1) return;

    const currK = kVals[kVals.length - 1];
    const prevK = kVals[kVals.length - 2];
    const kRising = currK > prevK + 1;
    const oversold = currK <= this.params.stoch_oversold;

    const currDeriv = derivatives[derivatives.length - 1];
    const prevDeriv = derivatives[derivatives.length - 2];
    const derivativeTurningUp = currDeriv > prevDeriv && currDeriv > this.params.derivative_threshold;

    const currCurv = curvatures[curvatures.length - 1];
    const positiveCurvature = currCurv > this.params.min_curvature;

    const nearSupport = bar.close <= sr.support * 1.02;

    if (kRising && oversold && derivativeTurningUp && positiveCurvature && nearSupport) {
      const cash = ctx.getCapital() * this.params.risk_percent * 0.995;
      const size = cash / bar.close;
      if (size > 0 && cash <= ctx.getCapital()) {
        const result = ctx.buy(bar.tokenId, size);
        if (result.success) {
          this.entryPrice.set(bar.tokenId, bar.close);
          this.entryBar.set(bar.tokenId, barNum);
        }
      }
    }
  }

  onComplete(_ctx: BacktestContext): void {}
}
