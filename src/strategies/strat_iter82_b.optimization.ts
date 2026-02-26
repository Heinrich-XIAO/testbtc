import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  window_size: { min: 30, max: 60, stepSize: 10 },
  q_min: { min: -3, max: -1, stepSize: 1 },
  q_max: { min: 1, max: 3, stepSize: 1 },
  width_threshold: { min: 0.1, max: 0.4, stepSize: 0.1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter82_b.params.json';
