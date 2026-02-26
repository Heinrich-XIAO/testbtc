import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  lp_period: { min: 8, max: 20, stepSize: 4 },
  lp_alpha: { min: 0.08, max: 0.25, stepSize: 0.05 },
  stoch_period: { min: 10, max: 18, stepSize: 4 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  breakout_threshold: { min: 0.004, max: 0.010, stepSize: 0.002 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.12, max: 0.20, stepSize: 0.02 },
  max_hold_bars: { min: 22, max: 34, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter151_d.params.json';
