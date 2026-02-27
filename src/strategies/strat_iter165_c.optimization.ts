import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  confirmation_bars: { min: 2, max: 4, stepSize: 1 },
  stoch_oversold: { min: 16, max: 24, stepSize: 4 },
  stop_loss: { min: 0.05, max: 0.12, stepSize: 0.035 },
  profit_target: { min: 0.10, max: 0.20, stepSize: 0.05 },
  max_hold_bars: { min: 20, max: 40, stepSize: 10 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter165_c.params.json';
