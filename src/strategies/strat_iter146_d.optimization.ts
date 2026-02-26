import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  trend_ma_period: { min: 80, max: 120, stepSize: 20 },
  accumulation_threshold: { min: 0.015, max: 0.03, stepSize: 0.005 },
  min_pullback: { min: 0.02, max: 0.05, stepSize: 0.01 },
  stoch_oversold: { min: 12, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 40, max: 70, stepSize: 10 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 60, max: 100, stepSize: 20 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter146_d.params.json';
