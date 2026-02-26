import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  garch_omega: { min: 0.000005, max: 0.00005, stepSize: 0.00001 },
  garch_alpha: { min: 0.05, max: 0.12, stepSize: 0.02 },
  garch_beta: { min: 0.85, max: 0.94, stepSize: 0.03 },
  vol_shift_threshold: { min: 1.20, max: 1.50, stepSize: 0.05 },
  shift_confirm_bars: { min: 1, max: 4, stepSize: 1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter152_a.params.json';
