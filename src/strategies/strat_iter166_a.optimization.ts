import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  min_hold_bars: { min: 10, max: 30, stepSize: 10 },
  stoch_oversold: { min: 16, max: 24, stepSize: 4 },
  sr_lookback_weeks: { min: 4, max: 12, stepSize: 4 },
  stop_loss: { min: 0.05, max: 0.10, stepSize: 0.05 },
  profit_target: { min: 0.10, max: 0.20, stepSize: 0.10 },
  risk_percent: { min: 0.30, max: 0.50, stepSize: 0.20 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter166_a.params.json';
