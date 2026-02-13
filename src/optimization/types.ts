export interface OptimizationConfig {
  maxIterations: number;
  convergenceThreshold: number;
  learningRate: number;
  randomSamples: number;
}

export interface ParamConfig {
  min: number;
  max: number;
  stepSize: number;
}

export interface OptimizationHistory {
  iteration: number;
  params: Record<string, number>;
  sharpeRatio: number;
}

export interface OptimizationResult {
  finalParams: Record<string, number>;
  bestSharpe: number;
  history: OptimizationHistory[];
  iterations: number;
  converged: boolean;
}

export interface SavedParams {
  [key: string]: number | SavedParamsMetadata;
}

export interface SavedParamsMetadata {
  best_sharpe: number;
  optimized_at: string;
}
