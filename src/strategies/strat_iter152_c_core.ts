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

function garch11(
  returns: number[],
  omega: number,
  alpha: number,
  gamma: number,
  beta: number
): { variance: number; leverageEffect: number } | null {
  if (returns.length < 20) return null;
  
  let variance = 0.0001;
  let sumSq = 0;
  for (let i = 0; i < Math.min(returns.length, 20); i++) {
    sumSq += returns[i] * returns[i];
  }
  variance = sumSq / Math.min(returns.length, 20);
  
  const n = returns.length;
  for (let i = 0; i < n; i++) {
    const ret = returns[i];
    const shock = ret * ret;
    const isNegativeShock = ret < 0 ? 1 : 0;
    const leverageTerm = gamma * shock * isNegativeShock;
    variance = omega + alpha * shock + leverageTerm + beta * variance;
  }
  
  const recentReturns = returns.slice(-5);
  const avgReturn = recentReturns.reduce((s, r) => s + r, 0) / recentReturns.length;
  const leverageEffect = avgReturn < 0 ? variance : variance * 0.5;
  
  return { variance, leverageEffect };
}

function volSpike(variance: number, varHistory: number[], threshold: number): boolean {
  if (varHistory.length < 5) return false;
  const avgVar = varHistory.slice(-5).reduce((s, v) => s + v, 0) / 5;
  return variance > avgVar * (1 + threshold);
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

export interface StratIter152CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  garch_omega: number;
  garch_alpha: number;
  garch_gamma: number;
  garch_beta: number;
  vol_spike_threshold: number;
  shock_lookback: number;
  min_shock_size: number;
  post_shock_bars: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter152CStrategy extends BaseIterStrategy<StratIter152CParams> {
  private kVals: Map<string, number[]> = new Map();
  private varianceHistory: Map<string, number[]> = new Map();
  private armed: Map<string, number> = new Map();
  
  constructor(params: Partial<StratIter152CParams> = {}) {
    super(
      'strat_iter152_c.params.json',
      {
        sr_lookback: 50,
        stoch_k_period: 14,
        stoch_oversold: 16,
        garch_omega: 0.00001,
        garch_alpha: 0.08,
        garch_gamma: 0.12,
        garch_beta: 0.88,
        vol_spike_threshold: 0.35,
        shock_lookback: 8,
        min_shock_size: 0.025,
        post_shock_bars: 3,
        stop_loss: 0.08,
        profit_target: 0.18,
        max_hold_bars: 28,
        risk_percent: 0.25,
      },
      params
    );
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    if (!this.kVals.has(bar.tokenId)) {
      this.kVals.set(bar.tokenId, []);
      this.varianceHistory.set(bar.tokenId, []);
    }
    
    const { series, barNum } = this.nextBar(bar);
    const k = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    if (k !== null) capPush(this.kVals.get(bar.tokenId)!, k);
    const kv = this.kVals.get(bar.tokenId)!;
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    
    if (series.closes.length > this.params.shock_lookback + 5) {
      const returns: number[] = [];
      for (let i = series.closes.length - this.params.shock_lookback - 1; i < series.closes.length - 1; i++) {
        if (series.closes[i] > 0) {
          returns.push((series.closes[i + 1] - series.closes[i]) / series.closes[i]);
        }
      }
      
      const garch = garch11(
        returns,
        this.params.garch_omega,
        this.params.garch_alpha,
        this.params.garch_gamma,
        this.params.garch_beta
      );
      
      if (garch) {
        capPush(this.varianceHistory.get(bar.tokenId)!, garch.variance);
        
        const vh = this.varianceHistory.get(bar.tokenId)!;
        if (vh.length >= this.params.shock_lookback) {
          const recentReturns = returns.slice(-this.params.shock_lookback);
          const avgReturn = recentReturns.reduce((s, r) => s + r, 0) / recentReturns.length;
          
          if (avgReturn <= -this.params.min_shock_size) {
            const spike = volSpike(garch.variance, vh, this.params.vol_spike_threshold);
            if (spike) {
              this.armed.set(bar.tokenId, barNum + this.params.post_shock_bars);
            }
          }
        }
      }
    }
    
    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const e = this.entryPrice.get(bar.tokenId)!;
      const eb = this.entryBar.get(bar.tokenId)!;
      if (
        bar.low <= e * (1 - this.params.stop_loss) ||
        bar.high >= e * (1 + this.params.profit_target) ||
        (sr && bar.high >= sr.resistance * 0.98) ||
        barNum - eb >= this.params.max_hold_bars
      ) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }
    
    if (!sr || shouldSkipPrice(bar.close) || kv.length < 2) return;
    
    const armedBar = this.armed.get(bar.tokenId);
    const isArmed = armedBar !== undefined && barNum <= armedBar;
    
    if (isArmed) {
      const nearSupport = bar.low <= sr.support * 1.015;
      const stochRecover = kv[kv.length - 2] < this.params.stoch_oversold && kv[kv.length - 1] >= this.params.stoch_oversold;
      const bullish = bar.close > bar.open;
      
      if (nearSupport && stochRecover && bullish) {
        this.open(ctx, bar, barNum, this.params.risk_percent);
        this.armed.delete(bar.tokenId);
      }
    }
  }
}
