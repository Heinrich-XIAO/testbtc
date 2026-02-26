import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  template_length: { min: 6, max: 12, stepSize: 2 },
  correlation_threshold: { min: 0.5, max: 0.85, stepSize: 0.05 },
  stoch_period: { min: 10, max: 18, stepSize: 2 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_overbought: { min: 82, max: 86, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.12, max: 0.20, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 32, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter90_e.params.json';
