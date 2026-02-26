import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  short_period: { min: 3, max: 8, stepSize: 1 },
  long_period: { min: 15, max: 30, stepSize: 5 },
  stoch_period: { min: 10, max: 18, stepSize: 2 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter89_b.params.json';