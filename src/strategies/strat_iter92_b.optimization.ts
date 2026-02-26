import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  kernel_bandwidth: { min: 0.08, max: 0.25, stepSize: 0.03 },
  kernel_lookback: { min: 25, max: 55, stepSize: 10 },
  prediction_threshold: { min: 0.006, max: 0.020, stepSize: 0.004 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_k_period: { min: 14, max: 14, stepSize: 1 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter92_b.params.json';
