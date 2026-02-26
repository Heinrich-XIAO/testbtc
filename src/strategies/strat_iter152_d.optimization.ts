import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  igarch_lookback: { min: 16, max: 36, stepSize: 4 },
  variance_threshold: { min: 1.8, max: 3.2, stepSize: 0.3 },
  momentum_lookback: { min: 6, max: 12, stepSize: 2 },
  momentum_threshold: { min: 0.006, max: 0.014, stepSize: 0.002 },
  stoch_period: { min: 10, max: 18, stepSize: 4 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stoch_overbought: { min: 80, max: 88, stepSize: 4 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 18, max: 30, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter152_d.params.json';
