import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  mom_period: { min: 8, max: 14, stepSize: 2 },
  mom_threshold: { min: -0.03, max: -0.01, stepSize: 0.005 },
  lookback_period: { min: 15, max: 25, stepSize: 5 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter143_c.params.json';
