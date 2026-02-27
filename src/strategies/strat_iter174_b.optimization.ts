import type { ParamConfig } from '../optimization/types';
export const optimizationConfig = { rsi_period: { min: 14, max: 14, stepSize: 1 }, rsi_oversold: { min: 25, max: 40, stepSize: 5 }, stop_loss: { min: 0.06, max: 0.12, stepSize: 0.02 }, profit_target: { min: 0.10, max: 0.25, stepSize: 0.05 }, max_hold_bars: { min: 16, max: 32, stepSize: 4 }, risk_percent: { min: 0.20, max: 0.30, stepSize: 0.05 } } as Record<string, ParamConfig>;
export const outputFile = 'strat_iter174_b.params.json';
