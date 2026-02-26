import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  scale_profit_1: { min: 0.06, max: 0.10, stepSize: 0.02 },
  scale_percent_1: { min: 0.2, max: 0.4, stepSize: 0.1 },
  scale_profit_2: { min: 0.10, max: 0.14, stepSize: 0.02 },
  scale_percent_2: { min: 0.2, max: 0.4, stepSize: 0.1 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter127_e.params.json';
