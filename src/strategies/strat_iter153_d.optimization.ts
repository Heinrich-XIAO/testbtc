import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  pattern_window: { min: 12, max: 28, stepSize: 4 },
  history_segments: { min: 3, max: 8, stepSize: 1 },
  cross_entropy_threshold: { min: 0.25, max: 0.50, stepSize: 0.05 },
  stoch_k_period: { min: 10, max: 18, stepSize: 2 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stoch_overbought: { min: 80, max: 88, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.24, stepSize: 0.02 },
  max_hold_bars: { min: 18, max: 32, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter153_d.params.json';
