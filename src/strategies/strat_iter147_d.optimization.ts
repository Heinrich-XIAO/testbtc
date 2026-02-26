import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  fast_exit_bars: { min: 2, max: 5, stepSize: 1 },
  min_profit_exit: { min: 0.01, max: 0.04, stepSize: 0.01 },
  tight_stop: { min: 0.02, max: 0.05, stepSize: 0.01 },
  stoch_oversold: { min: 14, max: 22, stepSize: 2 },
  max_hold_bars: { min: 5, max: 12, stepSize: 1 },
  risk_percent: { min: 0.08, max: 0.16, stepSize: 0.02 },
  sr_lookback: { min: 20, max: 40, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter147_d.params.json';
