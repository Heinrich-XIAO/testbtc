import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  reservoir_size: { min: 16, max: 40, stepSize: 4 },
  leak_rate: { min: 0.1, max: 0.5, stepSize: 0.05 },
  spectral_radius: { min: 0.6, max: 1.2, stepSize: 0.1 },
  input_scale: { min: 0.2, max: 0.8, stepSize: 0.1 },
  readout_size: { min: 4, max: 16, stepSize: 2 },
  learning_rate: { min: 0.005, max: 0.03, stepSize: 0.005 },
  lookback: { min: 20, max: 50, stepSize: 5 },
  stoch_k_period: { min: 14, max: 14, stepSize: 1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_overbought: { min: 82, max: 86, stepSize: 2 },
  stoch_rebound_delta: { min: 2, max: 5, stepSize: 1 },
  sr_lookback: { min: 45, max: 55, stepSize: 5 },
  support_buffer: { min: 0.01, max: 0.03, stepSize: 0.005 },
  support_reclaim_buffer: { min: 0.001, max: 0.01, stepSize: 0.002 },
  readout_threshold: { min: 0.01, max: 0.05, stepSize: 0.01 },
  prediction_horizon: { min: 2, max: 8, stepSize: 1 },
  resistance_exit_buffer: { min: 0.97, max: 0.995, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter63_a.params.json';
