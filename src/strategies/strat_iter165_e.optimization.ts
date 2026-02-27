import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  ma_period: { min: 30, max: 70, stepSize: 20 },
  slope_threshold: { min: 0.001, max: 0.005, stepSize: 0.002 },
  stoch_oversold: { min: 16, max: 24, stepSize: 4 },
  stop_loss: { min: 0.05, max: 0.10, stepSize: 0.05 },
  profit_target: { min: 0.10, max: 0.20, stepSize: 0.10 },
  max_hold_bars: { min: 20, max: 30, stepSize: 5 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.10 },
  stoch_period: { min: 12, max: 16, stepSize: 4 },
  stoch_overbought: { min: 76, max: 84, stepSize: 4 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter165_e.params.json';
