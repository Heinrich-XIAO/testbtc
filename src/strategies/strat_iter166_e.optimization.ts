import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  max_consecutive_losses: { min: 2, max: 4, stepSize: 1 },
  pause_after_losses: { min: 50, max: 100, stepSize: 25 },
  stoch_oversold: { min: 16, max: 24, stepSize: 4 },
  stoch_overbought: { min: 75, max: 85, stepSize: 5 },
  sr_lookback_weeks: { min: 4, max: 12, stepSize: 4 },
  stop_loss: { min: 0.05, max: 0.10, stepSize: 0.05 },
  profit_target: { min: 0.10, max: 0.20, stepSize: 0.10 },
  risk_percent: { min: 0.30, max: 0.50, stepSize: 0.20 },
  max_hold_bars: { min: 24, max: 32, stepSize: 4 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter166_e.params.json';
