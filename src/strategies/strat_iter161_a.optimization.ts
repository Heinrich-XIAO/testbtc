import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  wr_period: { min: 10, max: 20, stepSize: 2 },
  wr_oversold: { min: -90, max: -80, stepSize: 2 },
  support_lookback: { min: 30, max: 60, stepSize: 10 },
  support_buffer: { min: 0.010, max: 0.025, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter161_a.params.json';
