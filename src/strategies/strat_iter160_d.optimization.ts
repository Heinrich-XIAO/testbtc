import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  rsi_period: { min: 10, max: 18, stepSize: 2 },
  rsi_regime_lookback: { min: 30, max: 60, stepSize: 10 },
  rsi_regime_low_threshold: { min: 0.5, max: 1.0, stepSize: 0.1 },
  rsi_regime_high_threshold: { min: 1.0, max: 1.5, stepSize: 0.1 },
  rsi_rising_bars: { min: 1, max: 3, stepSize: 1 },
  support_buffer: { min: 0.010, max: 0.025, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter160_d.params.json';
