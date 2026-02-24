import type { ParamConfig } from '../optimization/types';

export const optimizationConfig = {
  sr_lookback: { min: 45, max: 55, stepSize: 5 },
  support_buffer: { min: 0.01, max: 0.03, stepSize: 0.005 },
  support_reclaim_buffer: { min: 0.001, max: 0.012, stepSize: 0.001 },
  support_touch_window: { min: 6, max: 20, stepSize: 2 },
  min_support_touches: { min: 1, max: 3, stepSize: 1 },
  particle_count: { min: 21, max: 71, stepSize: 10 },
  trend_persistence: { min: 0.7, max: 0.96, stepSize: 0.02 },
  drift_from_recent_return: { min: 2.0, max: 9.0, stepSize: 0.5 },
  process_noise: { min: 0.05, max: 0.35, stepSize: 0.02 },
  observation_window: { min: 5, max: 21, stepSize: 2 },
  likelihood_sigma_floor: { min: 0.001, max: 0.006, stepSize: 0.0005 },
  reversal_trend_cutoff: { min: -0.5, max: -0.05, stepSize: 0.05 },
  rebound_return_min: { min: -0.001, max: 0.004, stepSize: 0.0005 },
  posterior_entry_threshold: { min: 0.5, max: 0.85, stepSize: 0.02 },
  posterior_defensive_threshold: { min: 0.2, max: 0.6, stepSize: 0.02 },
  resistance_exit_buffer: { min: 0.97, max: 0.995, stepSize: 0.005 },
  stop_loss: { min: 0.06, max: 0.10, stepSize: 0.02 },
  profit_target: { min: 0.14, max: 0.22, stepSize: 0.02 },
  max_hold_bars: { min: 20, max: 36, stepSize: 4 },
  risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const outputFile = 'strat_iter62_b.params.json';
