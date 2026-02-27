import type { ParamConfig } from '../optimization/types';
import { SimpleMAStrategy } from './strat_simple_ma_01';

export const optimizationConfig = {
  fast_period: { min: 5, max: 20, stepSize: 5 },
  slow_period: { min: 20, max: 50, stepSize: 10 },
  stop_loss: { min: 0.05, max: 0.15, stepSize: 0.02 },
  trailing_stop: { min: 0.03, max: 0.10, stepSize: 0.02 },
  risk_percent: { min: 0.15, max: 0.35, stepSize: 0.05 },
} as Record<string, ParamConfig>;

export const StrategyClass = SimpleMAStrategy;
export const outputFile = 'strat_simple_ma_01.params.json';
