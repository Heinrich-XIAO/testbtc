import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  micro_move_threshold: { min: 0.003, max: 0.008, stepSize: 0.001 },
  quick_profit: { min: 0.04, max: 0.08, stepSize: 0.01 },
  tight_stop: { min: 0.03, max: 0.06, stepSize: 0.01 },
  stoch_oversold: { min: 14, max: 22, stepSize: 2 },
  max_hold_bars: { min: 5, max: 12, stepSize: 1 },
  risk_percent: { min: 0.10, max: 0.20, stepSize: 0.05 },
  sr_lookback: { min: 20, max: 40, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter147_a.params.json';
