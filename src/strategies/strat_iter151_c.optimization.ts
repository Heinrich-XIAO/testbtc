import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  bp_period: { min: 12, max: 36, stepSize: 4 },
  bp_bandwidth: { min: 0.25, max: 0.6, stepSize: 0.1 },
  bp_oversold: { min: -0.025, max: -0.005, stepSize: 0.005 },
  bp_overbought: { min: 0.005, max: 0.025, stepSize: 0.005 },
  stoch_k_period: { min: 10, max: 18, stepSize: 2 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter151_c.params.json';
