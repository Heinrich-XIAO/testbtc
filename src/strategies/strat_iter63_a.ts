import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenState = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  reservoir: number[];
  readout: number[];
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

function tanh(x: number): number {
  return Math.tanh(x);
}

function randomWeight(): number {
  return (Math.random() * 2 - 1) * 0.5;
}

export interface StratIter63AParams extends StrategyParams {
  reservoir_size: number;
  leak_rate: number;
  spectral_radius: number;
  input_scale: number;
  readout_size: number;
  learning_rate: number;
  lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stoch_overbought: number;
  stoch_rebound_delta: number;
  sr_lookback: number;
  support_buffer: number;
  support_reclaim_buffer: number;
  readout_threshold: number;
  prediction_horizon: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter63AStrategy implements Strategy {
  params: StratIter63AParams;

  private state: Map<string, TokenState> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private globalReadoutWeights: number[][] = [];

  constructor(params: Partial<StratIter63AParams> = {}) {
    const saved = loadSavedParams<StratIter63AParams>('strat_iter63_a.params.json');
    this.params = {
      reservoir_size: 24,
      leak_rate: 0.3,
      spectral_radius: 0.85,
      input_scale: 0.4,
      readout_size: 8,
      learning_rate: 0.01,
      lookback: 30,
      stoch_k_period: 14,
      stoch_oversold: 16,
      stoch_overbought: 84,
      stoch_rebound_delta: 3,
      sr_lookback: 50,
      support_buffer: 0.018,
      support_reclaim_buffer: 0.004,
      readout_threshold: 0.02,
      prediction_horizon: 4,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter63AParams;
    
    this.initGlobalReadout();
  }

  private initGlobalReadout(): void {
    const rSize = Math.floor(this.params.reservoir_size);
    const rdSize = Math.floor(this.params.readout_size);
    this.globalReadoutWeights = [];
    for (let i = 0; i < rSize; i++) {
      const row: number[] = [];
      for (let j = 0; j < rdSize; j++) {
        row.push(randomWeight());
      }
      this.globalReadoutWeights.push(row);
    }
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private getState(tokenId: string): TokenState {
    let s = this.state.get(tokenId);
    if (s) return s;

    const rSize = Math.floor(this.params.reservoir_size);
    s = {
      closes: [],
      highs: [],
      lows: [],
      returns: [],
      reservoir: new Array(rSize).fill(0),
      readout: new Array(Math.floor(this.params.readout_size)).fill(0),
      stoch: [],
      barNum: 0,
    };
    this.state.set(tokenId, s);
    return s;
  }

  private updateReservoir(s: TokenState, input: number): void {
    const rSize = s.reservoir.length;
    const leak = this.params.leak_rate;
    const scale = this.params.spectral_radius;
    
    for (let i = 0; i < rSize; i++) {
      let sum = input * (Math.random() * 0.5 + 0.5);
      for (let j = 0; j < rSize; j++) {
        const w = this.globalReadoutWeights[j]?.[i] || 0;
        sum += s.reservoir[j] * w * scale * 0.3;
      }
      s.reservoir[i] = (1 - leak) * s.reservoir[i] + leak * tanh(sum);
    }
  }

  private computeReadout(s: TokenState): number[] {
    const rSize = s.reservoir.length;
    const rdSize = s.readout.length;
    const output: number[] = [];
    
    for (let j = 0; j < rdSize; j++) {
      let sum = 0;
      for (let i = 0; i < rSize; i++) {
        sum += s.reservoir[i] * (this.globalReadoutWeights[i]?.[j] || 0);
      }
      output.push(tanh(sum * 0.5));
    }
    
    s.readout = output;
    return output;
  }

  private trainReadout(s: TokenState, targetReturn: number): void {
    if (s.returns.length < 10) return;
    
    const rdSize = s.readout.length;
    const lr = this.params.learning_rate;
    
    for (let j = 0; j < rdSize; j++) {
      const pred = s.readout[j];
      const error = targetReturn - pred * 0.1;
      for (let i = 0; i < s.reservoir.length; i++) {
        if (this.globalReadoutWeights[i]) {
          this.globalReadoutWeights[i][j] += lr * error * s.reservoir[i];
        }
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

    const k = stochK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_k_period)));
    if (k !== null) capPush(s.stoch, k, 800);
    
    const normInput = Math.tanh(ret * this.params.input_scale * 10);
    this.updateReservoir(s, normInput);
    
    const readout = this.computeReadout(s);
    
    const futureIdx = s.returns.length - 1 - Math.floor(this.params.prediction_horizon);
    if (futureIdx >= 5) {
      const futureRet = s.returns[futureIdx];
      this.trainReadout(s, futureRet);
    }

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
    const stochRebound = prevK <= this.params.stoch_oversold && k >= prevK + this.params.stoch_rebound_delta;

    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const supportReclaim = bar.close >= sr.support * (1 + this.params.support_reclaim_buffer);

    const prediction = readout.reduce((a, b) => a + b, 0) / readout.length;
    const reservoirSignal = prediction > this.params.readout_threshold;

    if (nearSupport && supportReclaim && stochRebound && reservoirSignal) {
      this.open(ctx, bar, s.barNum);
    }
  }
}
