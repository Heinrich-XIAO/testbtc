import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  autocorr_window: { min: 14, max: 36, stepSize: 2 },
  autocorr_threshold: { min: -0.20, max: 0.05, stepSize: 0.05 },
  corr_window: { min: 12, max: 36, stepSize: 4 },
  short_horizon: { min: 1, max: 4, stepSize: 1 },
  long_horizon: { min: 5, max: 14, stepSize: 1 },
  regime_corr_threshold: { min: -0.30, max: 0.40, stepSize: 0.05 },
  pullback_threshold: { min: -0.03, max: -0.005, stepSize: 0.005 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  support_buffer: { min: 0.005, max: 0.025, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter157_a.params.json';
