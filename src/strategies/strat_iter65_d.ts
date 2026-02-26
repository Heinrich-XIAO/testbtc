import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  stoch: number[];
  changepointProb: number[];
  runLength: number;
  hazardRate: number;
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

function normalPDF(x: number, mean: number, var_: number): number {
  const coeff = 1 / Math.sqrt(2 * Math.PI * var_);
  const exp = Math.exp(-0.5 * Math.pow(x - mean, 2) / var_);
  return coeff * exp;
}

function bayesianChangelog(returns: number[], hazardRate: number, pMean: number, pVar: number): number {
  if (returns.length < 2) return hazardRate;
  
  const currentReturn = returns[returns.length - 1];
  
  const predictiveMean = pMean;
  const predictiveVar = pVar * 2;
  
  const predictiveLikelihood = normalPDF(currentReturn, predictiveMean, predictiveVar);
  
  const growthProb = (1 - hazardRate) * predictiveLikelihood;
  const changepointProb = hazardRate;
  
  const evidence = growthProb + changepointProb;
  
  if (evidence === 0) return hazardRate;
  
  return changepointProb / evidence;
}

function computeChangepointProbability(returns: number[], lookback: number, hazardRate: number): number {
  if (returns.length < lookback) return hazardRate;
  
  const subset = returns.slice(-lookback);
  const mean = subset.reduce((a, b) => a + b, 0) / subset.length;
  const variance = subset.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / subset.length;
  
  return bayesianChangelog(returns, hazardRate, mean, Math.max(variance, 0.0001));
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

export interface StratIter65DParams extends StrategyParams {
  bayes_lookback: number;
  bayes_hazard_rate: number;
  bayes_prob_threshold: number;
  runlength_max: number;
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

export class StratIter65DStrategy implements Strategy {
  params: StratIter65DParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter65DParams> = {}) {
    const saved = loadSavedParams<StratIter65DParams>('strat_iter65_d.params.json');
    this.params = {
      bayes_lookback: 25,
      bayes_hazard_rate: 0.1,
      bayes_prob_threshold: 0.15,
      runlength_max: 20,
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
    } as StratIter65DParams;
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
      changepointProb: [],
      runLength: 0,
      hazardRate: this.params.bayes_hazard_rate,
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private computeBayesianChangelog(s: TokenState): void {
    const lookback = Math.floor(this.params.bayes_lookback);
    
    if (s.returns.length >= lookback) {
      const prob = computeChangepointProbability(s.returns, lookback, s.hazardRate);
      capPush(s.changepointProb, prob);
      
      if (prob > this.params.bayes_prob_threshold) {
        s.runLength = 0;
      } else {
        s.runLength++;
      }
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

    this.computeBayesianChangelog(s);

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

    if (k === null || s.stoch.length < 2 || s.changepointProb.length < 3) return;

    const prevK = s.stoch[s.stoch.length - 2];
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr * (1 + this.params.support_reclaim_buffer);

    const cpProb = s.changepointProb[s.changepointProb.length - 1];
    const lowChangepoint = cpProb < this.params.bayes_prob_threshold;

    const runLengthValid = s.runLength > 2 && s.runLength < this.params.runlength_max;

    if (nearSupport && supportReclaim && stochRebound && lowChangepoint && runLengthValid) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
