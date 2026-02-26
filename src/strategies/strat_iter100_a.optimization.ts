import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  lookback: { min: 5, max: 15, stepSize: 5 },
  temperature: { min: 0.005, max: 0.02, stepSize: 0.005 },
  signal_threshold: { min: 0.005, max: 0.012, stepSize: 0.002 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter100_a.params.json';