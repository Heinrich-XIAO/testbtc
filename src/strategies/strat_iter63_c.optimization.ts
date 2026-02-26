import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  compression_dim: { min: 4, max: 12, stepSize: 2 },
  info_window: { min: 25, max: 60, stepSize: 5 },
  mi_horizon: { min: 3, max: 8, stepSize: 1 },
  compression_threshold: { min: 0.5, max: 0.9, stepSize: 0.1 },
  mi_threshold: { min: 0.05, max: 0.25, stepSize: 0.05 },
  stoch_k_period: { min: 14, max: 14, stepSize: 1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_overbought: { min: 82, max: 86, stepSize: 2 },
  stoch_rebound_delta: { min: 2, max: 5, stepSize: 1 },
  sr_lookback: { min: 45, max: 55, stepSize: 5 },
  support_buffer: { min: 0.01, max: 0.03, stepSize: 0.005 },
  support_reclaim_buffer: { min: 0.001, max: 0.01, stepSize: 0.002 },
  resistance_exit_buffer: { min: 0.97, max: 0.995, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter63_c.params.json';
