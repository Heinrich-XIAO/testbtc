import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  tsi_oversold: { min: -35, max: -15, stepSize: 5 },
  long_period: { min: 20, max: 35, stepSize: 5 },
  short_period: { min: 10, max: 18, stepSize: 4 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter131_d.params.json';