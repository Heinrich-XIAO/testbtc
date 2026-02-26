import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  stoch_overbought: { min: 78, max: 86, stepSize: 2 },
  rsi_overbought: { min: 65, max: 75, stepSize: 5 },
  ma_period: { min: 15, max: 25, stepSize: 5 },
  fade_threshold: { min: 0.01, max: 0.03, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter142_a.params.json';
