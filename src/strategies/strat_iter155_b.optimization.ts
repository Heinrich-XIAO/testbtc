import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  cum_vol_lookback: { min: 16, max: 40, stepSize: 6 },
  cum_vol_threshold: { min: 0.40, max: 0.80, stepSize: 0.10 },
  cum_vol_confirm_bars: { min: 1, max: 3, stepSize: 1 },
  stoch_k_period: { min: 10, max: 18, stepSize: 4 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_overbought: { min: 82, max: 86, stepSize: 2 },
  spread_lookback: { min: 15, max: 30, stepSize: 5 },
  tight_spread_threshold: { min: 0.006, max: 0.012, stepSize: 0.002 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter155_b.params.json';
