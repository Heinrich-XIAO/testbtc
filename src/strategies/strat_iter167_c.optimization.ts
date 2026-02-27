import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  breakout_lookback: { min: 10, max: 30, stepSize: 10 },
  pullback_pct: { min: 0.3, max: 0.7, stepSize: 0.2 },
  stoch_oversold: { min: 16, max: 24, stepSize: 4 },
  stop_loss: { min: 0.05, max: 0.10, stepSize: 0.05 },
  profit_target: { min: 0.15, max: 0.25, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter167_c.params.json';
