import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  fast_window: { min: 1, max: 5, stepSize: 1 },
  slow_window: { min: 6, max: 16, stepSize: 2 },
  corr_window: { min: 12, max: 32, stepSize: 4 },
  depressed_corr_level: { min: -0.45, max: 0.0, stepSize: 0.05 },
  min_corr_momentum_turn: { min: 0.005, max: 0.06, stepSize: 0.005 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  support_buffer: { min: 0.005, max: 0.025, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter157_e.params.json';
