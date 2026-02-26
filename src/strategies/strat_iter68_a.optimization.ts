import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
  memory_dim: { min: 3, max: 6, stepSize: 1 },
  gate_threshold: { min: 0.45, max: 0.75, stepSize: 0.1 },
  sequence_length: { min: 3, max: 7, stepSize: 1 },
  decay_rate: { min: 0.70, max: 0.90, stepSize: 0.05 },
  stoch_k_period: { min: 14, max: 14, stepSize: 1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter68_a.params.json';
