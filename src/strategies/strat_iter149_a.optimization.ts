import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  volatility_mult: { min: 1.2, max: 2.0, stepSize: 0.2 },
  volatility_window: { min: 15, max: 25, stepSize: 5 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stop_loss: { min: 0.08, max: 0.12, stepSize: 0.02 },
  profit_target: { min: 0.12, max: 0.20, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 30, stepSize: 5 },
  risk_percent: { min: 0.15, max: 0.25, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter149_a.params.json';
