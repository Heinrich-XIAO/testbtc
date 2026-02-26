import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  sg_window: { min: 5, max: 11, stepSize: 2 },
  sg_polyorder: { min: 2, max: 4, stepSize: 1 },
  derivative_threshold: { min: 0.0001, max: 0.001, stepSize: 0.0001 },
  stoch_k_period: { min: 10, max: 18, stepSize: 2 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter89_c.params.json';
