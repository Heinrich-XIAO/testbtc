import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  egarch_lookback: { min: 20, max: 40, stepSize: 5 },
  asymmetry_threshold: { min: 0.15, max: 0.45, stepSize: 0.1 },
  vol_spike_threshold: { min: 1.0, max: 1.5, stepSize: 0.1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_overbought: { min: 82, max: 86, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.16, max: 0.24, stepSize: 0.02 },
  max_hold_bars: { min: 22, max: 34, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter152_b.params.json';
