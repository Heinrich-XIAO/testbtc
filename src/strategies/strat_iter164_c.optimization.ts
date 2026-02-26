import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  wr_period: { min: 10, max: 18, stepSize: 2 },
  wr_extreme: { min: -90, max: -75, stepSize: 5 },
  wr_recover: { min: -70, max: -45, stepSize: 5 },
  sr_lookback: { min: 35, max: 55, stepSize: 5 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.16, max: 0.24, stepSize: 0.02 },
  max_hold_bars: { min: 22, max: 34, stepSize: 3 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter164_c.params.json';
