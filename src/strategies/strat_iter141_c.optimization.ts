import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  cci_period: { min: 14, max: 28, stepSize: 2 },
  cci_oversold: { min: -150, max: -80, stepSize: 10 },
  atr_period: { min: 10, max: 18, stepSize: 4 },
  atr_multiplier: { min: 1.0, max: 2.0, stepSize: 0.5 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter141_c.params.json';
