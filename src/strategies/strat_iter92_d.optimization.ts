import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  spline_knots: { min: 4, max: 10, stepSize: 2 },
  spline_smoothing: { min: 0.3, max: 0.8, stepSize: 0.1 },
  derivative_threshold: { min: 0.004, max: 0.015, stepSize: 0.003 },
  min_curvature: { min: 0.0005, max: 0.003, stepSize: 0.0005 },
  stoch_oversold: { min: 14, max: 18, stepSize: 2 },
  stoch_k_period: { min: 14, max: 14, stepSize: 1 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
  sr_lookback: { min: 40, max: 60, stepSize: 10 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter92_d.params.json';
