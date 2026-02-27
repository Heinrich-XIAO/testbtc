import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  stoch_oversold: { min: 15, max: 25, stepSize: 5 },
  stoch_overbought: { min: 75, max: 85, stepSize: 5 },
  sr_lookback_weeks: { min: 4, max: 12, stepSize: 4 },
  stop_loss: { min: 0.05, max: 0.10, stepSize: 0.05 },
  profit_target: { min: 0.10, max: 0.20, stepSize: 0.10 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter165_a.params.json';
