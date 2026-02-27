import type { ParamConfig } from '../optimization/types';
export const optimizationConfig = { stoch_period: { min: 10, max: 18, stepSize: 4 }, stoch_oversold: { min: 15, max: 25, stepSize: 5 }, stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 }, profit_target: { min: 0.15, max: 0.15, stepSize: 0.01 }, max_hold_bars: { min: 16, max: 32, stepSize: 4 }, risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 } } as Record<string, ParamConfig>;
export const outputFile = 'strat_iter189_e.params.json';
