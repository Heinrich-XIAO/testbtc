import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  weight_rsi: { min: 0.2, max: 0.4, stepSize: 0.1 },
  weight_macd: { min: 0.2, max: 0.4, stepSize: 0.1 },
  weight_stoch: { min: 0.3, max: 0.5, stepSize: 0.1 },
  signal_threshold: { min: 0.55, max: 0.75, stepSize: 0.1 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter94_c.params.json';
