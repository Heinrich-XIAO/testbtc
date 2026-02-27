import type { ParamConfig } from '../optimization/types';
export const optimizationConfig = { fast_period: { min: 100, max: 100, stepSize: 1 }, slow_period: { min: 200, max: 200, stepSize: 1 }, stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 }, profit_target: { min: 0.10, max: 0.25, stepSize: 0.05 }, max_hold_bars: { min: 16, max: 32, stepSize: 4 }, risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 } } as Record<string, ParamConfig>;
export const outputFile = 'strat_iter196_c.params.json';
