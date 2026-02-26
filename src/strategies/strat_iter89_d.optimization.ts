import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  kalman_process_noise: { min: 0.00001, max: 0.001, stepSize: 0.0001 },
  kalman_measurement_noise: { min: 0.0001, max: 0.01, stepSize: 0.001 },
  variance_threshold: { min: 0.0001, max: 0.002, stepSize: 0.0002 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  warmup_bars: { min: 10, max: 30, stepSize: 5 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter89_d.params.json';
