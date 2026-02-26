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

function rsi(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export interface StratIter67EParams extends StrategyParams {
  stoch_weight: number;
  rsi_weight: number;
  mom_weight: number;
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  rsi_period: number;
  rsi_oversold: number;
  mom_period: number;
  mom_threshold: number;
  combined_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter67EStrategy implements Strategy {
  params: StratIter67EPrivateParams;
  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private kVals: Map<string, number[]> = new Map();
  private rsiVals: Map<string, number[]> = new Map();
  private momVals: Map<string, number[]> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter67EPrivateParams> = {}) {
    const saved = loadSavedParams<StratIter67EPrivateParams>('strat_iter67_e.params.json');
    this.params = { ...getDefaults(), ...saved, ...params } as StratIter67EPrivateParams;
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
    if (!this.rsiVals.has(bar.tokenId)) this.rsiVals.set(bar.tokenId, []);
    if (!this.momVals.has(bar.tokenId)) this.momVals.set(bar.tokenId, []);
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const r = rsi(series.closes, this.params.rsi_period);
    if (r !== null) capPush(this.rsiVals.get(bar.tokenId)!, r);
    const rv = this.rsiVals.get(bar.tokenId)!;
    const mom = series.closes.length > this.params.mom_period 
      ? (series.closes[series.closes.length - 1] - series.closes[series.closes.length - 1 - this.params.mom_period]) / series.closes[series.closes.length - 1 - this.params.mom_period]
      : 0;
    capPush(this.momVals.get(bar.tokenId)!, mom);
    const mv = this.momVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (bar.low <= e * (1 - this.params.stop_loss) || bar.high >= e * (1 + this.params.profit_target) || (sr && bar.high >= sr.resistance * 0.98) || barNum - eb >= this.params.max_hold_bars) this.close(ctx, bar.tokenId);
      return;
    }
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2 || rv.length < 2 || mv.length < 2) return;
    const nearSupport = bar.low <= sr.support * 1.015;
    let score = 0;
    if (kv.length >= 2 && kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold) score += this.params.stoch_weight;
    if (rv.length >= 1 && rv[rv.length - 1] <= this.params.rsi_oversold) score += this.params.rsi_weight;
    if (mv[mv.length - 1] > this.params.mom_threshold) score += this.params.mom_weight;
    if (nearSupport && score >= this.params.combined_threshold) this.open(ctx, bar, barNum, this.params.risk_percent);
  }
}

function getDefaults(): StratIter67EPrivateParams {
  return {
    stoch_weight: 0.5,
    rsi_weight: 0.3,
    mom_weight: 0.2,
    sr_lookback: 50,
    stoch_k_period: 14,
    stoch_oversold: 18,
    rsi_period: 14,
    rsi_oversold: 35,
    mom_period: 4,
    mom_threshold: 0.008,
    combined_threshold: 0.6,
    stop_loss: 0.08,
    profit_target: 0.18,
    max_hold_bars: 28,
    risk_percent: 0.25,
  };
}

interface StratIter67EPrivateParams extends StrategyParams {
  stoch_weight: number;
  rsi_weight: number;
  mom_weight: number;
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  rsi_period: number;
  rsi_oversold: number;
  mom_period: number;
  mom_threshold: number;
  combined_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}
