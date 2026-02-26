import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  divergence_lookback: { min: 6, max: 14, stepSize: 2 },
  rsi_period: { min: 10, max: 20, stepSize: 2 },
  rsi_rise_threshold: { min: 1, max: 5, stepSize: 1 },
  support_buffer: { min: 0.01, max: 0.02, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter160_b.params.json';
