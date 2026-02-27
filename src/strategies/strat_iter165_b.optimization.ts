import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  volume_threshold: { min: 1.2, max: 2.01, stepSize: 0.3 },
  volume_lookback: { min: 10, max: 30, stepSize: 10 },
  stoch_oversold: { min: 16, max: 24, stepSize: 4 },
  stop_loss: { min: 0.05, max: 0.10, stepSize: 0.05 },
  profit_target: { min: 0.10, max: 0.20, stepSize: 0.10 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter165_b.params.json';
