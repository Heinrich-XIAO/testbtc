import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  hurst: number;
  regime: number;
  barNum: number;
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

function capPush(values: number[], value: number, max = 1200): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function computeHurstExponent(returns: number[], maxLag: number): number {
  const n = returns.length;
  if (n < maxLag * 2) return 0.5;
  
  const lags: number[] = [];
  const rs: number[] = [];
  
  for (let lag = 2; lag <= maxLag; lag++) {
    const subset = returns.slice(-lag);
    if (subset.length < lag) continue;
    
    let mean = subset.reduce((a, b) => a + b, 0) / lag;
    let cumdev = 0;
    for (let i = 0; i < lag; i++) {
      cumdev += subset[i] - mean;
    }
    
    let r = -Infinity;
    let x = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < lag; i++) {
      x += subset[i] - mean;
      if (x > maxX) maxX = x;
      if (x < minX) minX = x;
    }
    r = maxX - minX;
    
    let s = 0;
    for (let i = 0; i < lag; i++) {
      s += (subset[i] - mean) ** 2;
    }
    s = Math.sqrt(s / lag);
    
    if (s > 0) {
      lags.push(Math.log(lag));
      rs.push(Math.log(r / s));
    }
  }
  
  if (lags.length < 3) return 0.5;
  
  const nL = lags.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < nL; i++) {
    sumX += lags[i];
    sumY += rs[i];
    sumXY += lags[i] * rs[i];
    sumX2 += lags[i] * lags[i];
  }
  
  const slope = (nL * sumXY - sumX * sumY) / (nL * sumX2 - sumX * sumX);
  return Math.max(0, Math.min(1, slope));
}

function classifyRegime(hurst: number, thresholdLow: number, thresholdHigh: number): number {
  if (hurst < thresholdLow) return -1;
  if (hurst > thresholdHigh) return 1;
  return 0;
}

function priorSupport(highs: number[], lows: number[], lookback: number): number | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return Math.min(...lows.slice(-(lookback + 1), -1));
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

export interface StratIter64DParams extends StrategyParams {
  hurst_lookback: number;
  hurst_max_lag: number;
  hurst_low_threshold: number;
  hurst_high_threshold: number;
  regime_risk_mult_low: number;
  regime_risk_mult_high: number;
  lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stoch_rebound_delta: number;
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter64DStrategy implements Strategy {
  params: StratIter64DParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter64DParams> = {}) {
    const saved = loadSavedParams<StratIter64DParams>('strat_iter64_d.params.json');
    this.params = {
      hurst_lookback: 60,
      hurst_max_lag: 20,
      hurst_low_threshold: 0.40,
      hurst_high_threshold: 0.60,
      regime_risk_mult_low: 1.5,
      regime_risk_mult_high: 0.6,
      lookback: 30,
      stoch_k_period: 14,
      stoch_oversold: 16,
      stoch_overbought: 84,
      stoch_rebound_delta: 3,
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter64DParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private getState(tokenId: string): TokenState {
    let s = this.state.get(tokenId);
    if (s) return s;

    s = {
      closes: [],
      highs: [],
      lows: [],
      returns: [],
      stoch: [],
      hurst: 0.5,
      regime: 0,
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeHurst(s: TokenState): void {
    const lookback = Math.floor(this.params.hurst_lookback);
    if (s.returns.length < lookback) return;

    const maxLag = Math.floor(this.params.hurst_max_lag);
    s.hurst = computeHurstExponent(s.returns.slice(-lookback), maxLag);
    s.regime = classifyRegime(s.hurst, this.params.hurst_low_threshold, this.params.hurst_high_threshold);
  }

  private getEffectiveRisk(): number {
    const r = this.params.risk_percent;
    if (this.params.regime === -1) {
      return Math.min(r * this.params.regime_risk_mult_low, 0.35);
    } else if (this.params.regime === 1) {
      return r * this.params.regime_risk_mult_high;
    }
    return r;
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number): boolean {
    const effectiveRisk = this.getEffectiveRisk();
    const cash = ctx.getCapital() * effectiveRisk * 0.995;
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
    if (shouldSkipPrice(bar.close)) return;

    const s = this.getState(bar.tokenId);
    s.barNum += 1;

    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;
    const ret = prevClose && prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    capPush(s.returns, ret, 800);

    this.computeHurst(s);

    const k = stochK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));
    if (k !== null) {
      s.stoch.push(k);
      if (s.stoch.length > 100) s.stoch.shift();
    }

    const sr = priorSupport(s.highs, s.lows, this.params.sr_lookback);
    if (!sr) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const maxHoldReached = s.barNum - enteredBar >= this.params.max_hold_bars;

      if (stopLossHit || profitTargetHit || maxHoldReached) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (k === null || s.stoch.length < 2) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    if (nearSupport && supportReclaim && stochRebound) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
