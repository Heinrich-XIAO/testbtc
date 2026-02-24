import type { Strategy, StrategyParams, BacktestContext, Bar } from '../types';
import * as fs from 'fs';
import * as path from 'path';

type TokenSeries = {
  closes: number[];
  highs: number[];
  lows: number[];
  returns: number[];
  kValues: number[];
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

function capPush(values: number[], value: number, max = 900): void {
  values.push(value);
  if (values.length > max) values.shift();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - avg) * (v - avg), 0) / values.length;
  return Math.sqrt(variance);
}

function priorSupportResistance(highs: number[], lows: number[], lookback: number): { support: number; resistance: number } | null {
  if (highs.length < lookback + 1 || lows.length < lookback + 1) return null;
  return {
    support: Math.min(...lows.slice(-(lookback + 1), -1)),
    resistance: Math.max(...highs.slice(-(lookback + 1), -1)),
  };
}

function stochasticK(closes: number[], highs: number[], lows: number[], period: number): number | null {
  if (closes.length < period || highs.length < period || lows.length < period) return null;
  const highSlice = highs.slice(-period);
  const lowSlice = lows.slice(-period);
  const hh = Math.max(...highSlice);
  const ll = Math.min(...lowSlice);
  if (hh === ll) return 50;
  return ((closes[closes.length - 1] - ll) / (hh - ll)) * 100;
}

function shouldSkipPrice(close: number): boolean {
  return close <= 0.05 || close >= 0.95;
}

export interface StratIter57CParams extends StrategyParams {
  sr_lookback: number;
  support_buffer: number;
  stoch_period: number;
  stoch_oversold: number;
  stoch_rebound_delta: number;
  volatility_window: number;
  volatility_floor: number;
  target_volatility: number;
  drawdown_window: number;
  drawdown_scale: number;
  vol_risk_ceiling: number;
  risk_state_vol_weight: number;
  risk_state_dd_weight: number;
  risk_deleverage_strength: number;
  min_risk_percent: number;
  max_risk_percent: number;
  risk_percent: number;
  forced_exit_risk_state: number;
  resistance_exit_buffer: number;
  stop_loss: number;
  profit_target: number;
  max_hold_bars: number;
}

export class StratIter57CStrategy implements Strategy {
  params: StratIter57CParams;

  private series: Map<string, TokenSeries> = new Map();
  private bars: Map<string, number> = new Map();
  private entryPrice: Map<string, number> = new Map();
  private entryBar: Map<string, number> = new Map();

  constructor(params: Partial<StratIter57CParams> = {}) {
    const saved = loadSavedParams<StratIter57CParams>('strat_iter57_c.params.json');
    this.params = {
      sr_lookback: 50,
      support_buffer: 0.015,
      stoch_period: 14,
      stoch_oversold: 16,
      stoch_rebound_delta: 4,
      volatility_window: 22,
      volatility_floor: 0.003,
      target_volatility: 0.009,
      drawdown_window: 36,
      drawdown_scale: 0.08,
      vol_risk_ceiling: 0.03,
      risk_state_vol_weight: 0.55,
      risk_state_dd_weight: 0.45,
      risk_deleverage_strength: 0.75,
      min_risk_percent: 0.08,
      max_risk_percent: 0.30,
      risk_percent: 0.25,
      forced_exit_risk_state: 0.85,
      resistance_exit_buffer: 0.985,
      stop_loss: 0.08,
      profit_target: 0.18,
      max_hold_bars: 28,
      ...saved,
      ...params,
    } as StratIter57CParams;
  }

  onInit(_ctx: BacktestContext): void {}

  onComplete(_ctx: BacktestContext): void {}

  private nextBar(bar: Bar): { series: TokenSeries; barNum: number } {
    if (!this.series.has(bar.tokenId)) {
      this.series.set(bar.tokenId, { closes: [], highs: [], lows: [], returns: [], kValues: [] });
      this.bars.set(bar.tokenId, 0);
    }

    const s = this.series.get(bar.tokenId)!;
    const prevClose = s.closes.length > 0 ? s.closes[s.closes.length - 1] : null;

    capPush(s.closes, bar.close);
    capPush(s.highs, bar.high);
    capPush(s.lows, bar.low);

    if (prevClose && prevClose > 0) {
      capPush(s.returns, (bar.close - prevClose) / prevClose);
    }

    const k = stochasticK(s.closes, s.highs, s.lows, Math.max(2, Math.floor(this.params.stoch_period)));
    if (k !== null) {
      capPush(s.kValues, k);
    }

    const barNum = (this.bars.get(bar.tokenId) || 0) + 1;
    this.bars.set(bar.tokenId, barNum);
    return { series: s, barNum };
  }

  private computeRiskState(series: TokenSeries): { riskState: number; dynamicRiskPercent: number } | null {
    const volWindow = Math.max(5, Math.floor(this.params.volatility_window));
    if (series.returns.length < volWindow || series.closes.length < 4) return null;

    const vol = stdDev(series.returns.slice(-volWindow));
    const volFloor = Math.max(1e-6, this.params.volatility_floor);
    const targetVol = Math.max(volFloor, this.params.target_volatility);
    const invVolScale = targetVol / Math.max(volFloor, vol);

    const ddWindow = Math.max(6, Math.floor(this.params.drawdown_window));
    const closeSlice = series.closes.slice(-ddWindow);
    const peak = Math.max(...closeSlice);
    const current = closeSlice[closeSlice.length - 1];
    const drawdown = peak > 0 ? (peak - current) / peak : 0;

    const volRisk = clamp(vol / Math.max(1e-6, this.params.vol_risk_ceiling), 0, 1);
    const ddRisk = clamp(drawdown / Math.max(1e-6, this.params.drawdown_scale), 0, 1);
    const volW = clamp(this.params.risk_state_vol_weight, 0, 1);
    const ddW = clamp(this.params.risk_state_dd_weight, 0, 1);
    const norm = Math.max(1e-6, volW + ddW);
    const riskState = clamp((volRisk * volW + ddRisk * ddW) / norm, 0, 1);

    const deleverage = 1 - clamp(this.params.risk_deleverage_strength, 0, 0.98) * riskState;
    const rawRisk = this.params.risk_percent * invVolScale * deleverage;
    const dynamicRiskPercent = clamp(rawRisk, this.params.min_risk_percent, this.params.max_risk_percent);
    return { riskState, dynamicRiskPercent };
  }

  private open(ctx: BacktestContext, bar: Bar, barNum: number, dynamicRiskPercent: number): boolean {
    const cash = ctx.getCapital() * dynamicRiskPercent * 0.995;
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
    const { series, barNum } = this.nextBar(bar);
    if (shouldSkipPrice(bar.close)) return;

    const sr = priorSupportResistance(series.highs, series.lows, this.params.sr_lookback);
    const risk = this.computeRiskState(series);
    if (!sr || !risk) return;

    const pos = ctx.getPosition(bar.tokenId);
    if (pos && pos.size > 0) {
      const entry = this.entryPrice.get(bar.tokenId);
      const enteredBar = this.entryBar.get(bar.tokenId);
      if (entry === undefined || enteredBar === undefined) return;

      const stopLossHit = bar.low <= entry * (1 - this.params.stop_loss);
      const profitTargetHit = bar.high >= entry * (1 + this.params.profit_target);
      const resistanceHit = bar.high >= sr.resistance * this.params.resistance_exit_buffer;
      const maxHoldReached = barNum - enteredBar >= this.params.max_hold_bars;
      const forcedDeleverageExit = risk.riskState >= this.params.forced_exit_risk_state;

      if (stopLossHit || profitTargetHit || resistanceHit || maxHoldReached || forcedDeleverageExit) {
        this.close(ctx, bar.tokenId);
      }
      return;
    }

    if (series.kValues.length < 2) return;
    const prevK = series.kValues[series.kValues.length - 2];
    const currK = series.kValues[series.kValues.length - 1];
    const nearSupport = bar.low <= sr.support * (1 + this.params.support_buffer);
    const stochRebound = prevK < this.params.stoch_oversold && currK >= this.params.stoch_oversold + this.params.stoch_rebound_delta;

    if (nearSupport && stochRebound) {
      this.open(ctx, bar, barNum, risk.dynamicRiskPercent);
    }
  }
}
