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

function capPush(values: number[], value: number, max = 700): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / values.length;
  return Math.sqrt(variance);
}

function stochK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const hh = Math.max(...highs.slice(-period));
  const ll = Math.min(...lows.slice(-period));
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

function rsi(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta;
    else losses -= delta;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

function nearSupport(low: number, support: number, supportBuffer: number): boolean {
  return low <= support * (1 + supportBuffer);
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export interface StratIter53CParams extends StrategyParams {
  sr_lookback: number;
  stoch_k_period: number;
  stoch_oversold: number;
  rsi_period: number;
  support_buffer: number;
  vol_short_period: number;
  vol_long_period: number;
  vol_contraction_ratio: number;
  evidence_decay: number;
  evidence_stoch_weight: number;
  evidence_rsi_weight: number;
  evidence_support_weight: number;
  evidence_vol_weight: number;
  prior_alpha: number;
  prior_beta: number;
  entry_posterior_threshold: number;
  exit_posterior_threshold: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
  risk_percent: number;
}

export class StratIter53CStrategy implements Strategy {
  params: StratIter53CParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();
  private posterior: Map<string, number> = new Map();
  private prevStoch: Map<string, number> = new Map();
  private prevRsi: Map<string, number> = new Map();

  constructor(params: Partial<StratIter53CParams> = {}) {
    const saved = loadSavedParams<StratIter53CParams>('strat_iter53_c.params.json');
    this.params = {
      sr_lookback: 50,
      stoch_k_period: 14,
      stoch_oversold: 18,
      rsi_period: 14,
      support_buffer: 0.015,
      vol_short_period: 8,
      vol_long_period: 30,
      vol_contraction_ratio: 0.85,
      evidence_decay: 0.92,
      evidence_stoch_weight: 1.0,
      evidence_rsi_weight: 0.8,
      evidence_support_weight: 1.2,
      evidence_vol_weight: 0.6,
      prior_alpha: 1,
      prior_beta: 3,
      entry_posterior_threshold: 0.62,
      exit_posterior_threshold: 0.44,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      risk_percent: 0.25,
      ...saved,
      ...params,
    } as StratIter53CParams;
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

  private rollingVolatility(closes: number[], period: number): number | null {
    if (closes.length < period + 1) return null;
    const returns: number[] = [];
    const start = closes.length - period;
    for (let i = start; i < closes.length; i++) {
      const prev = closes[i - 1];
      if (prev <= 0) return null;
      returns.push((closes[i] - prev) / prev);
    }
    return stdDev(returns);
  }

  private bayesianUpdate(tokenId: string, evidenceScore: number): number {
    const priorProb = this.posterior.get(tokenId) ?? this.params.prior_alpha / (this.params.prior_alpha + this.params.prior_beta);
    const priorLogit = Math.log(Math.max(1e-6, priorProb) / Math.max(1e-6, 1 - priorProb));
    const decay = clamp01(this.params.evidence_decay);
    const updatedLogit = priorLogit * decay + evidenceScore;
    const updated = logistic(updatedLogit);
    this.posterior.set(tokenId, updated);
    return updated;
  }

  onNext(ctx: BacktestContext, bar: Bar): void {
    const { series, barNum } = this.nextBar(bar);
    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const pos = ctx.getPosition(bar.tokenId);

    if (!sr || shouldSkipPrice(bar.close)) return;

    const currentStoch = stochK(series.closes, series.highs, series.lows, this.params.stoch_k_period);
    const currentRsi = rsi(series.closes, this.params.rsi_period);
    const prevStoch = this.prevStoch.get(bar.tokenId);
    const prevRsi = this.prevRsi.get(bar.tokenId);

    const shortVol = this.rollingVolatility(series.closes, this.params.vol_short_period);
    const longVol = this.rollingVolatility(series.closes, this.params.vol_long_period);

    const stochRebound =
      currentStoch !== null &&
      prevStoch !== undefined &&
      prevStoch < this.params.stoch_oversold &&
      currentStoch > prevStoch;

    const rsiUptick =
      currentRsi !== null &&
      prevRsi !== undefined &&
      currentRsi > prevRsi &&
      currentRsi < 55;

    const supportHeld =
      nearSupport(bar.low, sr.support, this.params.support_buffer) &&
      bar.close >= sr.support;

    const volContracted =
      shortVol !== null &&
      longVol !== null &&
      longVol > 0 &&
      shortVol <= longVol * this.params.vol_contraction_ratio;

    let evidenceScore = 0;
    evidenceScore += (stochRebound ? 1 : -0.4) * this.params.evidence_stoch_weight;
    evidenceScore += (rsiUptick ? 1 : -0.3) * this.params.evidence_rsi_weight;
    evidenceScore += (supportHeld ? 1 : -0.5) * this.params.evidence_support_weight;
    evidenceScore += (volContracted ? 1 : -0.2) * this.params.evidence_vol_weight;

    const posterior = this.bayesianUpdate(bar.tokenId, evidenceScore);

    if (currentStoch !== null) this.prevStoch.set(bar.tokenId, currentStoch);
    if (currentRsi !== null) this.prevRsi.set(bar.tokenId, currentRsi);

    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const entryBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || entryBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * 0.98;
      const maxHoldReached = barNum - entryBar >= this.params.max_hold_bars;
      const posteriorBreakdown = posterior < this.params.exit_posterior_threshold;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || posteriorBreakdown) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    const entryNearSupport = nearSupport(bar.low, sr.support, this.params.support_buffer);
    if (posterior > this.params.entry_posterior_threshold && entryNearSupport) {
      this.open(ctx, bar, barNum);
    }
  }
}
