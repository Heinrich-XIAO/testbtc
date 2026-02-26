import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  stoch_k_period: { min: 10, max: 18, stepSize: 2 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  vol_period: { min: 14, max: 28, stepSize: 4 },
  vol_lookback: { min: 60, max: 120, stepSize: 20 },
  vol_deviation_threshold: { min: 0.60, max: 0.80, stepSize: 0.05 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter158_d.params.json';
