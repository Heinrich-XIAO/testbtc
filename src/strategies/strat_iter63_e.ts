import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  ivSurface: number[];
  gradients: number[];
  momentum: number[];
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

function computeIVProxy(returns: number[], window: number): number {
  if (returns.length < window) return 0.3;
  
  const recent = returns.slice(-window);
  const squared: number[] = [];
  for (const r of recent) {
    squared.push(r * r);
  }
  
  const meanSq = squared.reduce((a, b) => a + b, 0) / squared.length;
  const sqrtIV = Math.sqrt(meanSq) * Math.sqrt(252);
  
  return Math.min(Math.max(sqrtIV, 0.1), 3.0);
}

function buildSurface(returns: number[], strikes: number[], spot: number, maturities: number[]): number[][] {
  const surface: number[][] = [];
  
  for (let i = 0; i < maturities.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < strikes.length; j++) {
      const m = maturities[i];
      const k = strikes[j];
      const moneyness = Math.log(spot / k);
      const baseIV = computeIVProxy(returns, 20);
      
      const skew = -0.3 * moneyness;
      const termStructure = 0.1 * m;
      const curvature = 0.05 * moneyness * moneyness;
      
      const iv = baseIV + skew + termStructure + curvature;
      row.push(Math.max(0.1, Math.min(2.0, iv)));
    }
    surface.push(row);
  }
  
  return surface;
}

function computeGradient(surface: number[][], strikeIdx: number, maturityIdx: number): { dIVdK: number; dIVdT: number } {
  const rows = surface.length;
  const cols = surface[0].length;
  
  let dIVdK = 0;
  if (strikeIdx > 0 && strikeIdx < cols - 1) {
    dIVdK = (surface[maturityIdx][strikeIdx + 1] - surface[maturityIdx][strikeIdx - 1]) / 2;
  }
  
  let dIVdT = 0;
  if (maturityIdx > 0 && maturityIdx < rows - 1) {
    dIVdT = (surface[maturityIdx + 1][strikeIdx] - surface[maturityIdx - 1][strikeIdx]) / 2;
  }
  
  return { dIVdK, dIVdT };
}

function gradientDescentStep(currentK: number, gradients: { dIVdK: number; dIVdT: number }, learningRate: number): number {
  const gradNorm = Math.sqrt(gradients.dIVdK ** 2 + gradients.dIVdT ** 2);
  const step = learningRate * gradNorm;
  
  if (gradients.dIVdK > 0) {
    return currentK + step;
  } else {
    return currentK - step;
  }
}

export interface StratIter63EParams extends StrategyParams {
  strike_count: number;
  maturity_count: number;
  learning_rate: number;
  target_moneyness: number;
  gradient_threshold: number;
  iv_regime_threshold: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stoch_rebound_delta: number;
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter63EStrategy implements Strategy {
  params: StratIter63EParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter63EParams> = {}) {
    const saved = loadSavedParams<StratIter63EParams>('strat_iter63_e.params.json');
    this.params = {
      strike_count: 5,
      maturity_count: 3,
      learning_rate: 0.02,
      target_moneyness: 1.0,
      gradient_threshold: 0.15,
      iv_regime_threshold: 0.35,
      stoch_k_period: 14,
      stoch_oversold: 16,
      stoch_overbought: 84,
      stoch_rebound_delta: 3,
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter63EParams;
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
      ivSurface: [],
      gradients: [],
      momentum: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeIVSignal(s: TokenState): { gradientMag: number; ivLevel: number } {
    if (s.returns.length < 30) return { gradientMag: 0, ivLevel: 0.3 };

    const currentPrice = s.closes[s.closes.length - 1];
    
    const strikes: number[] = [];
    const strikeCount = Math.floor(this.params.strike_count);
    const targetMoneyness = this.params.target_moneyness;
    for (let i = 0; i < strikeCount; i++) {
      const m = targetMoneyness + (i - Math.floor(strikeCount / 2)) * 0.1;
      strikes.push(currentPrice * Math.exp(-m));
    }
    
    const maturities: number[] = [];
    const matCount = Math.floor(this.params.maturity_count);
    for (let i = 1; i <= matCount; i++) {
      maturities.push(i * 0.1);
    }
    
    const surface = buildSurface(s.returns, strikes, currentPrice, maturities);
    
    const targetStrikeIdx = Math.floor(strikeCount / 2);
    const targetMaturityIdx = Math.floor(matCount / 2);
    
    const grads = computeGradient(surface, targetStrikeIdx, targetMaturityIdx);
    const gradientMag = Math.sqrt(grads.dIVdK ** 2 + grads.dIVdT ** 2);
    
    const ivLevel = surface[targetMaturityIdx][targetStrikeIdx];
    
    return { gradientMag, ivLevel };
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
    if (shouldSkipPrice(bar.close)) return;

    const s = this.getState(bar.tokenId);
    s.barNum += 1;

    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;
    const ret = prevClose && prevClose > 0 ? (bar.close - prevClose) / prevClose : 0;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);
    capPush(s.returns, ret, 800);

    const k = stochK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));
    if (k !== null) capPush(s.stoch, k, 800);

    const { gradientMag, ivLevel } = this.computeIVSignal(s);
    capPush(s.gradients, gradientMag, 800);
    capPush(s.ivSurface, ivLevel, 800);

    const sr = priorSupportResistance(s.highs, s.lows, this.params.sr_lookback);
    if (!sr) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = s.barNum - enteredBar >= this.params.max_hold_bars;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (k === null || s.stoch.length < 2) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = k <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);

    const ivSignal = gradientMag > this.params.gradient_threshold || ivLevel < this.params.iv_regime_threshold;

    if (nearSupport && supportReclaim && stochRebound && ivSignal) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
