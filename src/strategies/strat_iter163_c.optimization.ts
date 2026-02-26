import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  momentum_period: { min: 5, max: 12, stepSize: 1 },
  momentum_threshold: { min: 0.008, max: 0.025, stepSize: 0.003 },
  volume_lookback: { min: 15, max: 30, stepSize: 5 },
  volume_spike: { min: 1.5, max: 2.5, stepSize: 0.2 },
  stoch_period: { min: 14, max: 14, stepSize: 1 },
  stoch_oversold: { min: 16, max: 24, stepSize: 2 },
  sr_lookback: { min: 35, max: 55, stepSize: 5 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 32, stepSize: 3 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter163_c.params.json';
