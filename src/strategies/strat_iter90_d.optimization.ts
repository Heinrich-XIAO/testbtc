import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  pattern_length: { min: 5, max: 12, stepSize: 1 },
  lookahead_bars: { min: 6, max: 16, stepSize: 2 },
  min_success_rate: { min: 0.50, max: 0.65, stepSize: 0.05 },
  min_avg_return: { min: 0.01, max: 0.04, stepSize: 0.01 },
  k_neighbors: { min: 8, max: 25, stepSize: 3 },
  max_distance: { min: 0.08, max: 0.25, stepSize: 0.03 },
  warmup_bars: { min: 20, max: 50, stepSize: 10 },
  min_history: { min: 30, max: 80, stepSize: 10 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.12, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter90_d.params.json';
