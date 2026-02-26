import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  emd_window: { min: 30, max: 60, stepSize: 10 },
  max_imfs: { min: 3, max: 5, stepSize: 1 },
  low_freq_imf: { min: 1, max: 3, stepSize: 1 },
  trough_threshold: { min: 0.001, max: 0.005, stepSize: 0.001 },
  stoch_period: { min: 10, max: 18, stepSize: 2 },
  stoch_oversold: { min: 14, max: 22, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.12, max: 0.20, stepSize: 0.02 },
  max_hold_bars: { min: 18, max: 30, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter91_e.params.json';
