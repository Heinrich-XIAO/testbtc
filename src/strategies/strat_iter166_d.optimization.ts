import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  top_n_markets: { min: 50, max: 200, stepSize: 75 },
  volume_lookback: { min: 20, max: 40, stepSize: 20 },
  stoch_oversold: { min: 16, max: 24, stepSize: 4 },
  stop_loss: { min: 0.05, max: 0.10, stepSize: 0.05 },
  profit_target: { min: 0.10, max: 0.20, stepSize: 0.10 },
  max_hold_bars: { min: 24, max: 32, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.10 },
  support_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter166_d.params.json';
