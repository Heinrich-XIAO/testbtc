import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  trend_lookback: { min: 40, max: 60, stepSize: 10 },
  trend_slope_min: { min: 0.0005, max: 0.002, stepSize: 0.0005 },
  adx_threshold: { min: 20, max: 30, stepSize: 5 },
  stoch_oversold: { min: 12, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 35, max: 55, stepSize: 10 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 60, max: 100, stepSize: 20 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter146_e.params.json';
