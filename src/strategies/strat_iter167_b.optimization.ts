import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  gap_threshold: { min: 0.01, max: 0.03, stepSize: 0.01 },
  stop_loss: { min: 0.05, max: 0.10, stepSize: 0.05 },
  profit_target: { min: 0.05, max: 0.10, stepSize: 0.05 },
  max_hold_bars: { min: 3, max: 10, stepSize: 2 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter167_b.params.json';
