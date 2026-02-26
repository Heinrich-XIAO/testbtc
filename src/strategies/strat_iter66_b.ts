import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  returns: number[];
  apEn: number[];
  regimeState: number[];
  stoch: number[];
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

function computeApEn(series: number[], m: number, r: number): number {
  if (series.length < m + 1) return 0;
  
  const N = series.length;
  const phi = (mm: number): number => {
    const patterns: string[] = [];
    for (let i = 0; i <= N - mm; i++) {
      const pattern = series.slice(i, i + mm).map(v => 
        Math.abs(v - series[i]) <= r ? '0' : '1'
      ).join('');
      patterns.push(pattern);
    }
    
    let count = 0;
    for (const p1 of patterns) {
      let matches = 0;
      for (const p2 of patterns) {
        if (p1 === p2) matches++;
      }
      count += matches / (N - mm + 1);
    }
    return count > 0 ? Math.log(count / (N - mm + 1)) : 0;
  };
  
  return Math.abs(phi(m + 1) - phi(m));
}

function computeRegime(closes: number[], apenWindow: number, r: number): number {
  if (closes.length < apenWindow + 10) return 0.5;
  
  const subset = closes.slice(-apenWindow);
  const apen = computeApEn(subset, 2, r);
  
  const normalized = Math.min(Math.max(apen * 10, 0), 1);
  return normalized;
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

export interface StratIter66BParams extends StrategyParams {
  apen_window: number;
  apen_m: number;
  apen_r: number;
  regime_low: number;
  regime_high: number;
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

export class StratIter66BStrategy implements Strategy {
  params: StratIter66BParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter66BParams> = {}) {
    const saved = loadSavedParams<StratIter66BParams>('strat_iter66_b.params.json');
    this.params = {
      apen_window: 40,
      apen_m: 2,
      apen_r: 0.15,
      regime_low: 0.20,
      regime_high: 0.60,
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
    } as StratIter66BParams;
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
      volumes: [],
      returns: [],
      apEn: [],
      regimeState: [],
      stoch: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeApEnIndicators(s: TokenState): void {
    const aw = Math.floor(this.params.apen_window);
    const m = Math.floor(this.params.apen_m);
    const r = this.params.apen_r;
    
    if (s.closes.length >= aw) {
      const reg = computeRegime(s.closes, aw, r);
      capPush(s.regimeState, reg);
    }
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

    this.computeApEnIndicators(s);

    const k = stochK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));
    if (k !== null) {
      s.stoch = s.stoch || [];
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

    if (k === null || !s.stoch || s.stoch.length < 2 || s.regimeState.length < 3) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const reg = s.regimeState[s.regimeState.length - 1];
    const regAvg = s.regimeState.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const regimeValid = (reg >= 0 || regAvg >= 0 || s.regimeState.length < 5);

    if (nearSupport && supportReclaim && stochRebound && regimeValid) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
