import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  sr_lookback: { min: 30, max: 60, stepSize: 10 },
  bounce_threshold: { min: 0.005, max: 0.015, stepSize: 0.005 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stop_loss: { min: 0.05, max: 0.12, stepSize: 0.02 },
  profit_target: { min: 0.10, max: 0.25, stepSize: 0.05 },
  max_hold_bars: { min: 20, max: 50, stepSize: 10 },
  risk_percent: { min: 0.20, max: 0.40, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_sr_stoch_01.params.json';
