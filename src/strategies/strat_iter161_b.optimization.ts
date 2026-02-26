import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  wr_period: { min: 10, max: 20, stepSize: 2 },
  z_window: { min: 14, max: 30, stepSize: 4 },
  z_threshold: { min: -2.5, max: -1.0, stepSize: 0.3 },
  support_threshold: { min: 0.005, max: 0.025, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.01 },
  profit_target: { min: 0.12, max: 0.20, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 32, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.35, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter161_b.params.json';
