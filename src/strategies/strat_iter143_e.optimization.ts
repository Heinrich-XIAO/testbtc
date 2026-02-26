import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  lrc_period: { min: 15, max: 25, stepSize: 5 },
  lrc_std: { min: 1.5, max: 2.5, stepSize: 0.5 },
  channel_threshold: { min: 0.03, max: 0.08, stepSize: 0.01 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter143_e.params.json';
