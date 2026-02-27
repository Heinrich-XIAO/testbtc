import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  stoch_k_period: { min: 10, max: 20, stepSize: 2 },
  stoch_d_period: { min: 3, max: 7, stepSize: 1 },
  stoch_oversold: { min: 14, max: 22, stepSize: 2 },
  stoch_overbought: { min: 78, max: 86, stepSize: 2 },
  stop_loss: { min: 0.05, max: 0.12, stepSize: 0.02 },
  profit_target: { min: 0.10, max: 0.20, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 40, stepSize: 5 },
  risk_percent: { min: 0.20, max: 0.40, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_stoch_baseline_01.params.json';
