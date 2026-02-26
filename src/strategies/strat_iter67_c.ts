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

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1);
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

function computeGrangerMatrix(closes: number[], maxLag: number, lookback: number): number[][] {
  const matrix: number[][] = [];
  if (closes.length < lookback + maxLag + 1) {
    for (let i = 0; i < maxLag; i++) {
      matrix.push(new Array(maxLag).fill(0));
    }
    return matrix;
  }
  for (let i = 0; i < maxLag; i++) {
    matrix[i] = [];
    for (let j = 0; j < maxLag; j++) {
      let ssrReduced = 0;
      let ssrFull = 0;
      const startIdx = lookback + maxLag;
      for (let t = startIdx; t < closes.length; t++) {
        let predReduced = 0;
        for (let l = 1; l <= i + 1; l++) {
          if (t - l >= 0) predReduced += closes[t - l];
        }
        predReduced /= (i + 1);
        ssrReduced += (closes[t] - predReduced) ** 2;
        let predFull = 0;
        for (let l = 1; l <= i + 1; l++) {
          if (t - l >= 0) predFull += closes[t - l];
        }
        for (let l = 1; l <= j + 1; l++) {
          if (t - l - maxLag >= 0) predFull += closes[t - l - maxLag];
        }
        predFull /= (i + j + 2);
        ssrFull += (closes[t] - predFull) ** 2;
      }
      if (ssrReduced <= 0) {
        matrix[i][j] = 0;
      } else {
        matrix[i][j] = (ssrReduced - ssrFull) / ssrReduced;
      }
    }
  }
  return matrix;
}

export interface StratIter67CParams extends StrategyParams {
  granger_maxlag: number;
  granger_lookback: number;
  edge_strength_min: number;
  edge_strength_max: number;
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter67CStrategy implements Strategy {
  params: StratIter67CPrivateParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private grangerEdgeHist: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter67CPrivateParams> = {}) {
    const saved = loadSavedParams<StratIter67CPrivateParams>('strat_iter67_c.params.json');
    this.params = { ...getDefaults(), ...saved, ...params } as StratIter67CPrivateParams;
  }

  onInit(_ctx: BacktestContext): void {}
  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
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

  private open(ctx: BacktestContext, bar: Bar, barNum: number, riskPercent: number): boolean {
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

  private close(ctx: BacktestContext, tokenId: string): void {
    ctx.close(tokenId);
    this.entryPrice.delete(tokenId);
    this.entryBar.delete(tokenId);
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) this.kVals.set(bar.tokenId, []);
    if (!this.grangerEdgeHist.has(bar.tokenId)) this.grangerEdgeHist.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const granger = computeGrangerMatrix(series.closes, this.params.granger_maxlag, this.params.granger_lookback);
    let avgStrength = 0;
    let count = 0;
    for (let i = 0; i < granger.length; i++) {
      for (let j = 0; j < granger[i].length; j++) {
        if (granger[i][j] > 0) {
          avgStrength += granger[i][j];
          count += 1;
        }
      }
    }
    avgStrength = count > 0 ? avgStrength / count : 0;
    capPush(this.grangerEdgeHist.get(bar.tokenId)!, avgStrength);
    const gh = this.grangerEdgeHist.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || gh.length < 2) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
    const causalCond = gh[gh.length - 1] > this.params.edge_strength_min && gh[gh.length - 1] < this.params.edge_strength_max;
    if (nearSupport && stochRecover && causalCond) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

function getDefaults(): StratIter67CPrivateParams {
  return {
    granger_maxlag: 3,
    granger_lookback: 20,
    edge_strength_min: 0.02,
    edge_strength_max: 0.15,
    sr_lookback: 50,
    stoch_k_period: 14,
    stoch_oversold: 18,
    stop_loss: 0.08,
    profit_target: 0.18,
    max_hold_bars: 28,
    risk_percent: 0.25,
  };
}

interface StratIter67CPrivateParams extends StrategyParams {
  granger_maxlag: number;
  granger_lookback: number;
  edge_strength_min: number;
  edge_strength_max: number;
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}
