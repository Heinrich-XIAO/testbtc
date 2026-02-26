import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  channel_period: { min: 15, max: 25, stepSize: 5 },
  channel_width: { min: 0.015, max: 0.04, stepSize: 0.005 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stop_loss: { min: 0.04, max: 0.08, stepSize: 0.01 },
  profit_target: { min: 0.08, max: 0.14, stepSize: 0.02 },
  max_hold_bars: { min: 15, max: 25, stepSize: 5 },
  risk_percent: { min: 0.15, max: 0.25, stepSize: 0.05 },
  sr_lookback: { min: 30, max: 50, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter148_c.params.json';
