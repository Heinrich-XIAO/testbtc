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

function capPush(values: number[], value: number, max = 500): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const h = Math.max(...highs.slice(-period));
  const l = Math.min(...lows.slice(-period));
  if (h === l) return 50;
  return ((closes[closes.length - 1] - l) / (h - l)) * 100;
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

function computeReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  return returns;
}

function computeStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function gaussianPDF(x: number, mean: number, std: number): number {
  if (std === 0) return x === mean ? 1 : 0.0001;
  const exp = Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(std, 2)));
  return exp / (std * Math.sqrt(2 * Math.PI));
}

class SimpleHMM {
  private nStates: number;
  private transitionProbs: number[][];
  private emissionMeans: number[];
  private emissionStds: number[];
  private initialized: boolean = false;

  constructor(nStates: number) {
    this.nStates = nStates;
    this.transitionProbs = [];
    this.emissionMeans = [];
    this.emissionStds = [];
  }

  initialize(observations: number[]): void {
    if (observations.length < this.nStates * 5) return;

    const n = observations.length;
    const segmentSize = Math.floor(n / this.nStates);
    
    const segments: number[][] = [];
    for (let i = 0; i < this.nStates; i++) {
      const start = i * segmentSize;
      const end = i === this.nStates - 1 ? n : (i + 1) * segmentSize;
      segments.push(observations.slice(start, end));
    }

    segments.sort((a, b) => computeStdDev(a) - computeStdDev(b));

    this.emissionMeans = segments.map(seg => computeMean(seg));
    this.emissionStds = segments.map(seg => Math.max(computeStdDev(seg), 0.001));

    const sortedStds = [...this.emissionStds].sort((a, b) => a - b);
    const threshold = sortedStds[Math.floor(sortedStds.length / 2)];
    
    this.transitionProbs = [];
    for (let i = 0; i < this.nStates; i++) {
      this.transitionProbs.push([]);
      for (let j = 0; j < this.nStates; j++) {
        if (i === j) {
          this.transitionProbs[i].push(0.7);
        } else {
          this.transitionProbs[i].push(0.3 / (this.nStates - 1));
        }
      }
    }

    this.initialized = true;
  }

  forwardProbability(observations: number[]): number[] {
    if (!this.initialized || observations.length === 0) {
      return new Array(this.nStates).fill(1 / this.nStates);
    }

    const lastObs = observations[observations.length - 1];
    
    let alpha: number[] = new Array(this.nStates).fill(1 / this.nStates);
    
    for (const obs of observations) {
      const newAlpha: number[] = [];
      let total = 0;
      
      for (let j = 0; j < this.nStates; j++) {
        const emitProb = gaussianPDF(obs, this.emissionMeans[j], this.emissionStds[j]);
        
        let sum = 0;
        for (let i = 0; i < this.nStates; i++) {
          sum += alpha[i] * this.transitionProbs[i][j];
        }
        
        newAlpha.push(emitProb * sum);
        total += emitProb * sum;
      }
      
      if (total > 0) {
        for (let j = 0; j < this.nStates; j++) {
          newAlpha[j] /= total;
        }
      }
      
      alpha = newAlpha;
    }
    
    return alpha;
  }

  getLowVolStateProbability(observations: number[]): number {
    if (!this.initialized) return 0.5;
    
    const probs = this.forwardProbability(observations);
    
    let lowVolIdx = 0;
    let minStd = this.emissionStds[0];
    for (let i = 1; i < this.nStates; i++) {
      if (this.emissionStds[i] < minStd) {
        minStd = this.emissionStds[i];
        lowVolIdx = i;
      }
    }
    
    return probs[lowVolIdx];
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

abstract class BaseIterStrategy<P extends StrategyParams> implements Strategy {
  params: P;
  protected series: Map<string, TokenSeries> = new Map();
  protected bars: Map<string, number> = new Map();
  protected entryPrice: Map<string, number> = new Map();
  protected entryBar: Map<string, number> = new Map();

  constructor(fileName: string, defaults: P, params: Partial<P>) {
    const saved = loadSavedParams<P>(fileName);
    this.params = { ...defaults, ...saved, ...params } as P;
  }

  onInit(_ctx: BacktestContext): void {}

  protected nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
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

  protected open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
    const cash = ctx.getCapital() * riskPercent * 0.995;
    const size = cash / bar.close;
    if (size <= 0 || cash > ctx.getCapital()) return false;
    const result = ctx.buy(bar.tokenId, size);
    if (result.success) {
      this.entryPrice.set(bar.tokenId, bar.close);
      this.entryBar.set(bar.tokenId, barNum);
      return true;
    }
    return false;
  }

  protected close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onComplete(_ctx: BacktestContext): void {}
  abstract onNext(ctx: BacktestContext, bar: Bar): void;
}

export interface StratIter81CParams extends StrategyParams {
  n_states: number;
  window_size: number;
  state_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter81CStrategy extends BaseIterStrategy<StratIter81CParams> {
  private hmms: Map<string, SimpleHMM> = new Map();

  constructor(params: Partial<StratIter81CParams> = {}) {
    super('strat_iter81_c.params.json', {
      n_states: 2,
      window_size: 40,
      state_threshold: 0.7,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    let lowVolProb: number | null = null;
    
    if (series.closes.length >= this.params.window_size) {
      if (!this.hmms.has(bar.tokenId)) {
        this.hmms.set(bar.tokenId, new SimpleHMM(this.params.n_states));
      }
      
      const hmm = this.hmms.get(bar.tokenId)!;
      const windowCloses = series.closes.slice(-this.params.window_size);
      const returns = computeReturns(windowCloses);
      
      if (!hmm.isInitialized() && returns.length >= this.params.n_states * 5) {
        hmm.initialize(returns);
      }
      
      if (hmm.isInitialized()) {
        lowVolProb = hmm.getLowVolStateProbability(returns.slice(-20));
      }
    }

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) ||
          bar.high >= e * (1 + this.params.profit_target) ||
          (sr && bar.high >= sr.resistance * 0.98) ||
          barNum - eb >= this.params.max_hold_bars) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (shouldSkipPrice(bar.close) || !sr || lowVolProb === null) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;
    const favorableRegime = lowVolProb > this.params.state_threshold;

    if (nearSupport && stochOversold && favorableRegime) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
