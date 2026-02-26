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

function normalPdf(x: number, mean: number, variance: number): number {
  if (variance <= 0) return 0;
  const coeff = 1 / Math.sqrt(2 * Math.PI * variance);
  const exp = Math.exp(-((x - mean) ** 2) / (2 * variance));
  return coeff * exp;
}

class BayesianChangepoint {
  private runLengthProbs: number[] = [];
  private runningMean: number = 0;
  private runningVar: number = 0;
  private count: number = 0;
  private lastMean: number = 0;
  private lastChangeBar: number = -1;

  update(value: number, hazardRate: number, windowSize: number): { changeProb: number; regimeMean: number } {
    this.count++;
    const delta = value - this.runningMean;
    this.runningMean += delta / this.count;
    if (this.count > 1) {
      this.runningVar += delta * (value - this.runningMean);
    }

    if (this.runLengthProbs.length === 0) {
      this.runLengthProbs = [1.0];
      return { changeProb: 0, regimeMean: value };
    }

    const maxRunLength = Math.min(this.runLengthProbs.length, windowSize);
    const newProbs: number[] = [];

    const predMean = this.runningMean;
    const predVar = Math.max(this.runningVar / Math.max(this.count, 1), 0.001);
    const obsProb = normalPdf(value, predMean, predVar);

    let changeProb = hazardRate * obsProb;

    for (let r = 0; r < maxRunLength; r++) {
      const growthProb = (1 - hazardRate) * this.runLengthProbs[r] * obsProb;
      newProbs.push(growthProb);
    }
    newProbs.push(changeProb);

    const total = newProbs.reduce((s, p) => s + p, 0);
    if (total > 0) {
      for (let i = 0; i < newProbs.length; i++) {
        newProbs[i] /= total;
      }
    }

    this.runLengthProbs = newProbs;
    const probChange = newProbs[newProbs.length - 1];

    if (probChange > 0.5) {
      this.lastChangeBar = this.count;
      this.lastMean = this.runningMean;
      this.runningMean = value;
      this.runningVar = 0;
      this.count = 1;
      this.runLengthProbs = [1.0];
    }

    return { changeProb: probChange, regimeMean: this.runningMean };
  }

  getLastChangeBar(): number {
    return this.lastChangeBar;
  }

  getLastMean(): number {
    return this.lastMean;
  }

  getCurrentMean(): number {
    return this.runningMean;
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

export interface StratIter85BParams extends StrategyParams {
  hazard_rate: number;
  window_size: number;
  change_threshold: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
  sr_lookback: number;
}

export class StratIter85BStrategy extends BaseIterStrategy<StratIter85BParams> {
  private changepoint: Map<string, BayesianChangepoint> = new Map();
  private prevChangeProb: Map<string, number> = new Map();

  constructor(params: Partial<StratIter85BParams> = {}) {
    super('strat_iter85_b.params.json', {
      hazard_rate: 0.03,
      window_size: 30,
      change_threshold: 0.5,
      stoch_oversold: 16,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      sr_lookback: 50,
    }, params);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.changepoint.has(bar.tokenId)) {
      this.changepoint.set(bar.tokenId, new BayesianChangepoint());
      this.prevChangeProb.set(bar.tokenId, 0);
    }

    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, 14);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);

    const cp = this.changepoint.get(bar.tokenId)!;
    const { changeProb, regimeMean } = cp.update(
      bar.close,
      this.params.hazard_rate,
      this.params.window_size
    );

    const prevProb = this.prevChangeProb.get(bar.tokenId) || 0;
    this.prevChangeProb.set(bar.tokenId, changeProb);

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

    if (shouldSkipPrice(bar.close) || !sr) return;

    const nearSupport = bar.low <= sr.support * 1.015;
    const stochOversold = k !== null && k < this.params.stoch_oversold;

    const changeDetected = changeProb > this.params.change_threshold;
    const prevMean = cp.getLastMean();
    const bearishRegime = prevMean > 0 && regimeMean < prevMean;
    const priceBelowNewMean = bar.close < regimeMean;

    if (nearSupport && stochOversold && changeDetected && bearishRegime && priceBelowNewMean) {
      this.open(ctx, bar, barNum, this.params.risk_percent);
    }
  }
}
