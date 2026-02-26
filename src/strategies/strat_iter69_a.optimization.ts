import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  embedding_dim: { min: 3, max: 6, stepSize: 1 },
  tau: { min: 2, max: 5, stepSize: 1 },
  fnn_threshold: { min: 0.10, max: 0.25, stepSize: 0.05 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_k_period: { min: 14, max: 14, stepSize: 1 },
  min_dimension: { min: 2, max: 3, stepSize: 1 },
  reconstruction_threshold: { min: 0.05, max: 0.12, stepSize: 0.02 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter69_a.params.json';
