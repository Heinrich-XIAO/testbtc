import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  atr_period: { min: 10, max: 18, stepSize: 2 },
  atr_multiplier: { min: 2.0, max: 3.5, stepSize: 0.25 },
  stoch_period: { min: 14, max: 14, stepSize: 1 },
  stoch_oversold: { min: 18, max: 26, stepSize: 2 },
  sr_lookback: { min: 30, max: 50, stepSize: 5 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 32, stepSize: 3 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter163_e.params.json';
