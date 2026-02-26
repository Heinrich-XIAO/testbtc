import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  adaptation_window: { min: 20, max: 40, stepSize: 10 },
  volatility_adjust: { min: 1.2, max: 2.0, stepSize: 0.2 },
  stoch_oversold: { min: 14, max: 20, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.10, max: 0.16, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 30, stepSize: 5 },
  risk_percent: { min: 0.15, max: 0.25, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter150_c.params.json';