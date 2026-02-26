import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  rsi_period: { min: 10, max: 18, stepSize: 2 },
  rsi_oversold: { min: 25, max: 35, stepSize: 5 },
  rsi_recover: { min: 35, max: 45, stepSize: 5 },
  fast_ma_period: { min: 7, max: 12, stepSize: 1 },
  slow_ma_period: { min: 18, max: 28, stepSize: 2 },
  sr_lookback: { min: 30, max: 50, stepSize: 5 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.12, max: 0.20, stepSize: 0.02 },
  max_hold_bars: { min: 18, max: 30, stepSize: 3 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter163_b.params.json';
