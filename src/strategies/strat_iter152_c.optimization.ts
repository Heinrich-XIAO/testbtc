import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  vol_spike_threshold: { min: 0.25, max: 0.50, stepSize: 0.05 },
  min_shock_size: { min: 0.015, max: 0.035, stepSize: 0.005 },
  post_shock_bars: { min: 2, max: 5, stepSize: 1 },
  garch_alpha: { min: 0.05, max: 0.12, stepSize: 0.02 },
  garch_gamma: { min: 0.08, max: 0.18, stepSize: 0.03 },
  garch_beta: { min: 0.82, max: 0.92, stepSize: 0.02 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter152_c.params.json';
