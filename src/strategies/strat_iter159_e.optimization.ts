import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  partial_profit: { min: 0.06, max: 0.12, stepSize: 0.02 },
  partial_percent: { min: 0.3, max: 0.7, stepSize: 0.1 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  momentum_period: { min: 6, max: 12, stepSize: 2 },
  strong_momentum_threshold: { min: 0.008, max: 0.016, stepSize: 0.002 },
  fade_threshold: { min: -0.004, max: -0.001, stepSize: 0.001 },
  fade_lookback: { min: 8, max: 16, stepSize: 2 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stoch_k_period: { min: 10, max: 18, stepSize: 2 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter159_e.params.json';
