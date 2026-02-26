import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  fast_window: { min: 1, max: 5, stepSize: 1 },
  slow_window: { min: 6, max: 16, stepSize: 2 },
  slow_oversold_threshold: { min: -0.05, max: -0.005, stepSize: 0.005 },
  fast_rebound_delta: { min: 0.001, max: 0.015, stepSize: 0.002 },
  min_proxy_expansion: { min: 0.0, max: 0.02, stepSize: 0.002 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  support_buffer: { min: 0.005, max: 0.025, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter157_c.params.json';
