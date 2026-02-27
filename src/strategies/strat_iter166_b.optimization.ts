import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  stoch_oversold: { min: 16, max: 24, stepSize: 4 },
  stop_loss: { min: 0.05, max: 0.10, stepSize: 0.05 },
  profit_target: { min: 0.15, max: 0.25, stepSize: 0.10 },
  risk_percent: { min: 0.50, max: 0.80, stepSize: 0.15 },
  max_positions: { min: 3, max: 10, stepSize: 3.5 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter166_b.params.json';
