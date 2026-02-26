import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  window_size: { min: 10, max: 30, stepSize: 10 },
  num_samples: { min: 50, max: 150, stepSize: 50 },
  confidence: { min: 0.85, max: 0.95, stepSize: 0.05 },
  signal_threshold: { min: 0.005, max: 0.012, stepSize: 0.002 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter107_b.params.json';
