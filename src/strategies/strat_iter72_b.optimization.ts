import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  min_scale: { min: 1, max: 2, stepSize: 1 },
  max_scale: { min: 4, max: 6, stepSize: 1 },
  embedding_dim: { min: 2, max: 3, stepSize: 1 },
  tolerance: { min: 0.1, max: 0.3, stepSize: 0.05 },
  mse_threshold: { min: 0.5, max: 1.5, stepSize: 0.25 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter72_b.params.json';
