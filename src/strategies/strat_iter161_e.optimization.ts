import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  cci_period: { min: 10, max: 20, stepSize: 2 },
  cci_oversold: { min: -120, max: -60, stepSize: 20 },
  cci_momentum_threshold: { min: -10, max: 10, stepSize: 5 },
  sr_lookback: { min: 30, max: 60, stepSize: 10 },
  support_zone_threshold: { min: 0.005, max: 0.02, stepSize: 0.005 },
  min_support_touches: { min: 1, max: 3, stepSize: 1 },
  resistance_threshold: { min: 0.97, max: 0.995, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter161_e.params.json';
