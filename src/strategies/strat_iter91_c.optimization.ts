import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  wavelet_window: { min: 24, max: 48, stepSize: 8 },
  decomposition_levels: { min: 2, max: 4, stepSize: 1 },
  low_freq_threshold: { min: 0.001, max: 0.006, stepSize: 0.001 },
  high_freq_threshold: { min: 0.01, max: 0.04, stepSize: 0.01 },
  stoch_period: { min: 10, max: 18, stepSize: 2 },
  stoch_oversold: { min: 14, max: 22, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.12, max: 0.20, stepSize: 0.02 },
  max_hold_bars: { min: 18, max: 30, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter91_c.params.json';
