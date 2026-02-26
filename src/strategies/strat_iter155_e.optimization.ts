import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  vacuum_lookback: { min: 10, max: 30, stepSize: 5 },
  vacuum_threshold: { min: 0.015, max: 0.035, stepSize: 0.005 },
  vacuum_min_range: { min: 0.005, max: 0.015, stepSize: 0.002 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_overbought: { min: 82, max: 86, stepSize: 2 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  min_support_touches: { min: 2, max: 3, stepSize: 1 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter155_e.params.json';
