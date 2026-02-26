import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  gap_threshold: { min: 0.02, max: 0.05, stepSize: 0.01 },
  fade_window: { min: 2, max: 5, stepSize: 1 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.10, max: 0.16, stepSize: 0.02 },
  max_hold_bars: { min: 15, max: 25, stepSize: 5 },
  risk_percent: { min: 0.15, max: 0.25, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter149_c.params.json';
