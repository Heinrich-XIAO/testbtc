import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  window_size: { min: 15, max: 30, stepSize: 5 },
  latent_dim: { min: 2, max: 5, stepSize: 1 },
  reconstruction_error_threshold: { min: 0.03, max: 0.10, stepSize: 0.02 },
  anomaly_threshold: { min: 1.5, max: 2.5, stepSize: 0.2 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_k_period: { min: 14, max: 14, stepSize: 1 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter69_b.params.json';
