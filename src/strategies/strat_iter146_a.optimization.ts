import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  weekly_ma_period: { min: 120, max: 200, stepSize: 20 },
  trend_strength: { min: 0.01, max: 0.04, stepSize: 0.01 },
  stoch_oversold: { min: 12, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 },
  profit_target: { min: 0.15, max: 0.25, stepSize: 0.05 },
  max_hold_bars: { min: 40, max: 80, stepSize: 10 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 80, max: 120, stepSize: 20 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter146_a.params.json';
