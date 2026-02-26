import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  cci_period: { min: 14, max: 24, stepSize: 2 },
  cci_extreme: { min: -140, max: -80, stepSize: 10 },
  cci_recover: { min: -60, max: -20, stepSize: 10 },
  sr_lookback: { min: 35, max: 55, stepSize: 5 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.16, max: 0.24, stepSize: 0.02 },
  max_hold_bars: { min: 22, max: 34, stepSize: 3 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter164_a.params.json';
