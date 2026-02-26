import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  window_size: { min: 10, max: 25, stepSize: 5 },
  huber_k: { min: 1.0, max: 1.5, stepSize: 0.1 },
  max_iter: { min: 3, max: 7, stepSize: 2 },
  signal_threshold: { min: 0.005, max: 0.012, stepSize: 0.002 },
  estimate_threshold: { min: 0.002, max: 0.008, stepSize: 0.002 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter107_e.params.json';
