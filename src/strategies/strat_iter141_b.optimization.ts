import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  ma_period: { min: 15, max: 25, stepSize: 5 },
  macd_fast: { min: 10, max: 14, stepSize: 2 },
  macd_slow: { min: 22, max: 30, stepSize: 4 },
  macd_signal: { min: 7, max: 11, stepSize: 2 },
  dmi_period: { min: 10, max: 18, stepSize: 4 },
  adx_threshold: { min: 20, max: 30, stepSize: 5 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter141_b.params.json';
