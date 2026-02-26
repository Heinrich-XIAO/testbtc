import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  rotation_period: { min: 20, max: 40, stepSize: 10 },
  trend_threshold: { min: 0.015, max: 0.03, stepSize: 0.005 },
  range_threshold: { min: 0.01, max: 0.02, stepSize: 0.005 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.10, max: 0.16, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 30, stepSize: 5 },
  risk_percent: { min: 0.15, max: 0.25, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter150_a.params.json';