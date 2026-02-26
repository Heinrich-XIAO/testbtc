import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  cci_period: { min: 10, max: 20, stepSize: 2 },
  cci_oversold: { min: -120, max: -80, stepSize: 10 },
  cci_tighten: { min: -100, max: -60, stepSize: 10 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  near_support_pct: { min: 1.01, max: 1.04, stepSize: 0.01 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter161_c.params.json';
