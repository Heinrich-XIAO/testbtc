import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  stoch_period: { min: 14, max: 14, stepSize: 1 },
  stoch_slope_period: { min: 2, max: 4, stepSize: 1 },
  stoch_slope_threshold: { min: 1.5, max: 4.0, stepSize: 0.5 },
  stoch_max: { min: 28, max: 40, stepSize: 3 },
  ma_period: { min: 16, max: 28, stepSize: 2 },
  sr_lookback: { min: 40, max: 60, stepSize: 5 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.16, max: 0.24, stepSize: 0.02 },
  max_hold_bars: { min: 22, max: 34, stepSize: 3 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter163_d.params.json';
