import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  stoch_extreme_low: { min: 3, max: 8, stepSize: 1 },
  stoch_extreme_high: { min: 92, max: 98, stepSize: 2 },
  rsi_extreme: { min: 20, max: 30, stepSize: 5 },
  wr_extreme: { min: -98, max: -92, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter142_c.params.json';
