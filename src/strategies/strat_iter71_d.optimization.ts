import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  min_box_size: { min: 4, max: 8, stepSize: 2 },
  max_box_size: { min: 20, max: 40, stepSize: 10 },
  dfa_threshold: { min: 0.40, max: 0.55, stepSize: 0.05 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter71_d.params.json';
