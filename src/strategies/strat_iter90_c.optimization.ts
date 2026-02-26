import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  pattern_length: { min: 8, max: 16, stepSize: 2 },
  forecast_bars: { min: 6, max: 14, stepSize: 2 },
  dtw_threshold: { min: 0.10, max: 0.20, stepSize: 0.02 },
  min_positive_ratio: { min: 0.50, max: 0.65, stepSize: 0.05 },
  min_samples: { min: 3, max: 8, stepSize: 1 },
  stoch_k_period: { min: 10, max: 18, stepSize: 2 },
  stoch_oversold: { min: 14, max: 22, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 18, max: 30, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter90_c.params.json';
