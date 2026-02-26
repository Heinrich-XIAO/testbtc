import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  reversal_threshold: { min: 0.01, max: 0.025, stepSize: 0.005 },
  momentum_window: { min: 3, max: 7, stepSize: 1 },
  quick_profit: { min: 0.05, max: 0.10, stepSize: 0.01 },
  tight_stop: { min: 0.03, max: 0.06, stepSize: 0.01 },
  stoch_oversold: { min: 14, max: 22, stepSize: 2 },
  max_hold_bars: { min: 6, max: 14, stepSize: 2 },
  risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
  sr_lookback: { min: 20, max: 40, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter147_b.params.json';
