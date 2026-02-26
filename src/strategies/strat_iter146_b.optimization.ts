import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  monthly_ma_period: { min: 480, max: 960, stepSize: 120 },
  bias_threshold: { min: 0.02, max: 0.05, stepSize: 0.01 },
  stoch_oversold: { min: 12, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
  profit_target: { min: 0.18, max: 0.28, stepSize: 0.05 },
  max_hold_bars: { min: 48, max: 96, stepSize: 12 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 100, max: 150, stepSize: 25 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter146_b.params.json';
