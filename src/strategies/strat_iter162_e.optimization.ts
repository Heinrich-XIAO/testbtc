import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  stoch_k_period: { min: 12, max: 16, stepSize: 2 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  macd_fast: { min: 8, max: 16, stepSize: 4 },
  macd_slow: { min: 20, max: 30, stepSize: 4 },
  macd_signal: { min: 7, max: 11, stepSize: 2 },
  support_buffer: { min: 0.010, max: 0.020, stepSize: 0.005 },
  momentum_lookback: { min: 2, max: 5, stepSize: 1 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter162_e.params.json';
