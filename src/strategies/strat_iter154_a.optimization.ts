import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  stoch_k_period: { min: 10, max: 18, stepSize: 4 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_overbought: { min: 82, max: 86, stepSize: 2 },
  spread_lookback: { min: 15, max: 30, stepSize: 5 },
  tight_spread_threshold: { min: 0.006, max: 0.012, stepSize: 0.002 },
  volatility_lookback: { min: 8, max: 16, stepSize: 4 },
  max_volatility: { min: 0.020, max: 0.035, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter154_a.params.json';
