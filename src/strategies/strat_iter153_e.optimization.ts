import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  alpha: { min: 1.5, max: 3.5, stepSize: 0.5 },
  entropy_threshold: { min: 0.3, max: 0.8, stepSize: 0.1 },
  lookback: { min: 20, max: 50, stepSize: 6 },
  rsi_oversold: { min: 25, max: 35, stepSize: 5 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.10, max: 0.18, stepSize: 0.02 },
  max_hold_bars: { min: 18, max: 30, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.35, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter153_e.params.json';
