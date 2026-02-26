import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  momentum_threshold: { min: -0.02, max: 0, stepSize: 0.005 },
  bb_period: { min: 15, max: 25, stepSize: 5 },
  bb_mult: { min: 1.5, max: 2.5, stepSize: 0.5 },
  kc_period: { min: 15, max: 25, stepSize: 5 },
  kc_mult: { min: 1.0, max: 2.0, stepSize: 0.5 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter134_b.params.json';