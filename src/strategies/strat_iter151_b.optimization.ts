import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  dft_lookback: { min: 40, max: 80, stepSize: 10 },
  phase_lookback: { min: 10, max: 30, stepSize: 5 },
  trough_threshold: { min: 0.10, max: 0.25, stepSize: 0.05 },
  min_period: { min: 6, max: 12, stepSize: 2 },
  max_period: { min: 30, max: 50, stepSize: 10 },
  stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.24, stepSize: 0.02 },
  max_hold_bars: { min: 16, max: 32, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.35, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter151_b.params.json';
