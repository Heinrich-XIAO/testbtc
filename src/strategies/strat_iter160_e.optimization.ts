import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  rsi_period: { min: 10, max: 18, stepSize: 2 },
  z_window: { min: 14, max: 30, stepSize: 4 },
  z_threshold: { min: -2.0, max: -1.0, stepSize: 0.25 },
  support_buffer: { min: 0.010, max: 0.020, stepSize: 0.002 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter160_e.params.json';
