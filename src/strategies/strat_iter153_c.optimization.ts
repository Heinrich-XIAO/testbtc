import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  entropy_lookback: { min: 20, max: 50, stepSize: 6 },
  entropy_bins: { min: 4, max: 12, stepSize: 2 },
  entropy_threshold: { min: 0.50, max: 0.80, stepSize: 0.05 },
  stoch_k_period: { min: 10, max: 18, stepSize: 2 },
  stoch_d_period: { min: 2, max: 5, stepSize: 1 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stoch_overbought: { min: 80, max: 88, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.24, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter153_c.params.json';
