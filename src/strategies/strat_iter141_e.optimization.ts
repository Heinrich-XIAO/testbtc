import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  fast_period: { min: 3, max: 7, stepSize: 2 },
  medium_period: { min: 10, max: 16, stepSize: 3 },
  slow_period: { min: 20, max: 32, stepSize: 6 },
  cross_threshold: { min: 0.0, max: 0.002, stepSize: 0.001 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter141_e.params.json';
