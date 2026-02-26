import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  autocorr_period: { min: 15, max: 30, stepSize: 5 },
  autocorr_threshold: { min: -0.2, max: 0.0, stepSize: 0.05 },
  stoch_period: { min: 10, max: 18, stepSize: 4 },
  stoch_oversold: { min: 14, max: 22, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.12, max: 0.20, stepSize: 0.02 },
  max_hold_bars: { min: 18, max: 30, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter90_a.params.json';
