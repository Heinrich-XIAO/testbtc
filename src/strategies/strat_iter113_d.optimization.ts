import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  env_period: { min: 15, max: 25, stepSize: 5 },
  env_percent: { min: 0.03, max: 0.08, stepSize: 0.01 },
  env_threshold: { min: 0.03, max: 0.10, stepSize: 0.02 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter113_d.params.json';