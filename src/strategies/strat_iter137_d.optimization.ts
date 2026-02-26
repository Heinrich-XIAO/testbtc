import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  lrc_position: { min: 0, max: 0.2, stepSize: 0.05 },
  lrc_period: { min: 14, max: 28, stepSize: 7 },
  num_std: { min: 1.5, max: 2.5, stepSize: 0.5 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter137_d.params.json';