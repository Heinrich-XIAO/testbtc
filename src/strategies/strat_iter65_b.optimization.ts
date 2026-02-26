import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  rmt_lookback: { min: 12, max: 30, stepSize: 4 },
  rmt_num_assets: { min: 3, max: 8, stepSize: 1 },
  rmt_spread_threshold: { min: 0.4, max: 0.8, stepSize: 0.1 },
  rmt_regime_require: { min: 0, max: 1, stepSize: 1 },
  lookback: { min: 20, max: 50, stepSize: 5 },
  stoch_k_period: { min: 14, max: 14, stepSize: 1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_overbought: { min: 82, max: 86, stepSize: 2 },
  stoch_rebound_delta: { min: 2, max: 5, stepSize: 1 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  support_buffer: { min: 0.01, max: 0.03, stepSize: 0.005 },
  support_reclaim_buffer: { min: 0.001, max: 0.008, stepSize: 0.002 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter65_b.params.json';
