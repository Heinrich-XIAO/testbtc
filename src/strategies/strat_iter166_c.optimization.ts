import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  cooldown_bars: { min: 10, max: 30, stepSize: 10 },
  stoch_oversold: { min: 16, max: 24, stepSize: 4 },
  stop_loss: { min: 0.05, max: 0.10, stepSize: 0.05 },
  profit_target: { min: 0.10, max: 0.20, stepSize: 0.10 },
  risk_percent: { min: 0.30, max: 0.50, stepSize: 0.20 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  stoch_k_period: { min: 12, max: 16, stepSize: 2 },
  max_hold_bars: { min: 25, max: 35, stepSize: 5 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter166_c.params.json';
