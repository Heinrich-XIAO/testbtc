import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  fft_window: { min: 48, max: 96, stepSize: 16 },
  num_harmonics: { min: 2, max: 5, stepSize: 1 },
  harmonic_lookback: { min: 3, max: 8, stepSize: 1 },
  min_harmonic_strength: { min: 0.002, max: 0.010, stepSize: 0.002 },
  stoch_period: { min: 10, max: 18, stepSize: 2 },
  stoch_oversold: { min: 14, max: 22, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.12, max: 0.20, stepSize: 0.02 },
  max_hold_bars: { min: 18, max: 30, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter91_b.params.json';
