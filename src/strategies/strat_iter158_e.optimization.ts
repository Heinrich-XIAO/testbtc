import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  vol_period: { min: 10, max: 20, stepSize: 2 },
  vol_rank_period: { min: 20, max: 40, stepSize: 5 },
  cluster_length: { min: 3, max: 6, stepSize: 1 },
  vol_change_threshold: { min: 20, max: 35, stepSize: 5 },
  support_buffer: { min: 0.010, max: 0.020, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter158_e.params.json';
