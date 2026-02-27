import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  opening_bars: { min: 3, max: 10, stepSize: 2 },
  breakout_buffer: { min: 0.001, max: 0.005, stepSize: 0.002 },
  stop_loss: { min: 0.5, max: 2.0, stepSize: 0.5 },
  profit_target: { min: 1, max: 3, stepSize: 1 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter167_e.params.json';
