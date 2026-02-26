import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  strike_count: { min: 3, max: 7, stepSize: 1 },
  maturity_count: { min: 2, max: 5, stepSize: 1 },
  learning_rate: { min: 0.005, max: 0.05, stepSize: 0.01 },
  target_moneyness: { min: 0.9, max: 1.1, stepSize: 0.05 },
  gradient_threshold: { min: 0.01, max: 0.2, stepSize: 0.03 },
  iv_regime_threshold: { min: 0.15, max: 0.45, stepSize: 0.05 },
  stoch_k_period: { min: 14, max: 14, stepSize: 1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_overbought: { min: 82, max: 86, stepSize: 2 },
  stoch_rebound_delta: { min: 2, max: 5, stepSize: 1 },
  sr_lookback: { min: 45, max: 55, stepSize: 5 },
  support_buffer: { min: 0.01, max: 0.03, stepSize: 0.005 },
  support_reclaim_buffer: { min: 0.001, max: 0.01, stepSize: 0.002 },
  resistance_exit_buffer: { min: 0.97, max: 0.995, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter63_e.params.json';
