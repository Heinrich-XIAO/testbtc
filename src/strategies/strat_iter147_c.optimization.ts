import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  small_target: { min: 0.03, max: 0.07, stepSize: 0.01 },
  tight_stop: { min: 0.02, max: 0.05, stepSize: 0.01 },
  min_r_ratio: { min: 1.0, max: 2.0, stepSize: 0.25 },
  stoch_oversold: { min: 14, max: 22, stepSize: 2 },
  max_hold_bars: { min: 5, max: 12, stepSize: 1 },
  risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
  sr_lookback: { min: 20, max: 40, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter147_c.params.json';
