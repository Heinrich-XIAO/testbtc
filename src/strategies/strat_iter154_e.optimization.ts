import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  sr_lookback: { min: 30, max: 60, stepSize: 10 },
  flow_lookback: { min: 4, max: 12, stepSize: 2 },
  absorption_window: { min: 3, max: 8, stepSize: 1 },
  absorption_threshold: { min: 2, max: 5, stepSize: 1 },
  flow_momentum_threshold: { min: 0.005, max: 0.015, stepSize: 0.002 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter154_e.params.json';
