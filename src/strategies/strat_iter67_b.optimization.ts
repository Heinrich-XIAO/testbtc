import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  loop_lookback: { min: 16, max: 32, stepSize: 4 },
  loop_normfactor: { min: 1.2, max: 2.0, stepSize: 0.2 },
  loop_threshold_low: { min: 0.25, max: 0.45, stepSize: 0.05 },
  loop_threshold_high: { min: 0.55, max: 0.75, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  stoch_k_period: { min: 14, max: 14, stepSize: 1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter67_b.params.json';
