import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  long_ma_period: { min: 150, max: 250, stepSize: 25 },
  short_ma_period: { min: 30, max: 70, stepSize: 10 },
  ma_diff_threshold: { min: 0.01, max: 0.025, stepSize: 0.005 },
  stoch_oversold: { min: 12, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
  profit_target: { min: 0.15, max: 0.25, stepSize: 0.05 },
  max_hold_bars: { min: 40, max: 60, stepSize: 10 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 60, max: 100, stepSize: 20 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter146_c.params.json';
