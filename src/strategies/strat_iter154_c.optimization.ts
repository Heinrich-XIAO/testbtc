import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  depth_lookback: { min: 20, max: 50, stepSize: 10 },
  depth_threshold: { min: 0.4, max: 0.8, stepSize: 0.1 },
  min_depth_bars: { min: 2, max: 5, stepSize: 1 },
  stoch_period: { min: 10, max: 20, stepSize: 2 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stoch_overbought: { min: 80, max: 88, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.10, max: 0.16, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 30, stepSize: 5 },
  risk_percent: { min: 0.15, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter154_c.params.json';
