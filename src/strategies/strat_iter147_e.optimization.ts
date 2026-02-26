import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  hf_threshold: { min: 0.005, max: 0.012, stepSize: 0.001 },
  quick_profit: { min: 0.03, max: 0.06, stepSize: 0.01 },
  tight_stop: { min: 0.02, max: 0.04, stepSize: 0.005 },
  stoch_oversold: { min: 16, max: 24, stepSize: 2 },
  max_hold_bars: { min: 4, max: 8, stepSize: 1 },
  risk_percent: { min: 0.08, max: 0.14, stepSize: 0.02 },
  sr_lookback: { min: 20, max: 35, stepSize: 5 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter147_e.params.json';
