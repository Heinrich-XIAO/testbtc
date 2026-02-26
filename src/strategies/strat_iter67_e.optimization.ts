import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  stoch_weight: { min: 0.3, max: 0.6, stepSize: 0.1 },
  rsi_weight: { min: 0.2, max: 0.4, stepSize: 0.1 },
  mom_weight: { min: 0.1, max: 0.3, stepSize: 0.1 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  stoch_k_period: { min: 14, max: 14, stepSize: 1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  rsi_period: { min: 14, max: 14, stepSize: 1 },
  rsi_oversold: { min: 30, max: 40, stepSize: 5 },
  mom_period: { min: 3, max: 6, stepSize: 1 },
  mom_threshold: { min: 0.005, max: 0.015, stepSize: 0.002 },
  combined_threshold: { min: 0.5, max: 0.8, stepSize: 0.1 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter67_e.params.json';
