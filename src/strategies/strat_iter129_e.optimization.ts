import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  be_trigger: { min: 0.03, max: 0.07, stepSize: 0.01 },
  be_offset: { min: 0.005, max: 0.02, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter129_e.params.json';
