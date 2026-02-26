import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  priceStates: number[];
  transferEntropy: number;
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

function discretize(value: number, bins: number): number {
  return Math.min(Math.floor(value * bins), bins - 1);
}

function computeTransferEntropy(future: number[], past: number[], bins: number): number {
  if (future.length < 10 || past.length < 10) return 0;
  
  const n = Math.min(future.length, past.length);
  let te = 0;
  const countXY: Map<string, number> = new Map();
  const countX: Map<number, number> = new Map();
  const countY: Map<number, number> = new Map();
  const total = n - 1;
  
  for (let i = 1; i < n; i++) {
    const y = discretize(past[i - 1], bins);
    const x = discretize(future[i - 1], bins);
    const xyKey = `${x}_${y}`;
    
    countXY.set(xyKey, (countXY.get(xyKey) || 0) + 1);
    countX.set(x, (countX.get(x) || 0) + 1);
    countY.set(y, (countY.get(y) || 0) + 1);
  }
  
  for (const [xyKey, countXYVal] of countXY) {
    const [xStr, yStr] = xyKey.split('_');
    const x = parseInt(xStr);
    const y = parseInt(yStr);
    
    const pxy = countXYVal / total;
    const px = (countX.get(x) || 0) / total;
    const py = (countY.get(y) || 0) / total;
    
    if (px > 0 && py > 0 && pxy > 0) {
      te += pxy * Math.log2((pxy * py) / (px * py + 0.0001));
    }
  }
  
  return Math.max(0, te);
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

export interface StratIter64BParams extends StrategyParams {
  te_lookback: number;
  te_bins: number;
  te_lag: number;
  te_threshold: number;
  te_direction: number;
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

export class StratIter64BStrategy implements Strategy {
  params: StratIter64BParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter64BParams> = {}) {
    const saved = loadSavedParams<StratIter64BParams>('strat_iter64_b.params.json');
    this.params = {
      te_lookback: 40,
      te_bins: 4,
      te_lag: 3,
      te_threshold: 0.08,
      te_direction: 1,
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
    } as StratIter64BParams;
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
      priceStates: [],
      transferEntropy: 0,
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeTE(s: TokenState): void {
    const lookback = Math.floor(this.params.te_lookback);
    const lag = Math.floor(this.params.te_lag);
    if (s.returns.length < lookback + lag) return;

    const recentReturns = s.returns.slice(-lookback);
    const pastSeries = recentReturns.slice(0, -lag);
    const futureSeries = recentReturns.slice(lag);

    const bins = Math.floor(this.params.te_bins);
    this.params.transferEntropy = computeTransferEntropy(futureSeries, pastSeries, bins);
    s.transferEntropy = this.params.transferEntropy;
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

    this.computeTE(s);

    const k = stochK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));

    if (!s.stoch) s.stoch = [];
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

    const teStrong = s.transferEntropy > this.params.te_threshold;
    const tePositive = this.params.te_direction > 0;

    if (nearSupport && supportReclaim && stochRebound && teStrong && tePositive) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
