import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  atr_period: { min: 10, max: 20, stepSize: 5 },
  atr_stop_mult: { min: 1.5, max: 3.0, stepSize: 0.5 },
  trail_percent: { min: 0.04, max: 0.08, stepSize: 0.01 },
  use_trailing: { min: 0, max: 1, stepSize: 1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter127_b.params.json';
