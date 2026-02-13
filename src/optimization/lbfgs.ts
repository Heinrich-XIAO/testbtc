import type { Strategy, StoredData, PricePoint } from '../types';
import { BacktestEngine } from '../backtest/engine';
import type { OptimizationConfig, ParamConfig, OptimizationResult, OptimizationHistory } from './types';

interface LBFGSState {
  s: number[]; // Position difference
  y: number[]; // Gradient difference
  rho: number; // 1 / (s^T * y)
}

export class LBFGSOptimizer {
  private data: StoredData;
  private strategyClass: new (params: Partial<Record<string, number>>) => Strategy;
  private paramConfigs: Record<string, ParamConfig>;
  private config: OptimizationConfig;
  private quiet: boolean = false;
  private paramNames: string[];
  private dim: number;
  
  // L-BFGS parameters
  private m: number; // Memory size
  private history: LBFGSState[];
  private gradHistory: Map<string, number>;

  constructor(
    data: StoredData,
    strategyClass: new (params: Partial<Record<string, number>>) => Strategy,
    paramConfigs: Record<string, ParamConfig>,
    config: Partial<OptimizationConfig> = {}
  ) {
    this.data = data;
    this.strategyClass = strategyClass;
    this.paramConfigs = paramConfigs;
    this.config = {
      maxIterations: config.maxIterations ?? 100,
      convergenceThreshold: config.convergenceThreshold ?? 1e-6,
      learningRate: config.learningRate ?? 1.0,
    };
    
    this.paramNames = Object.keys(paramConfigs);
    this.dim = this.paramNames.length;
    this.m = 10; // Keep last 10 iterations
    this.history = [];
    this.gradHistory = new Map();
  }

  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  optimize(initialParams?: Record<string, number> | null): OptimizationResult {
    const history: OptimizationHistory[] = [];
    let params: Record<string, number>;
    
    if (initialParams) {
      params = { ...initialParams };
    } else {
      params = this.getDefaultParams();
    }

    let x = this.paramsToVector(params);
    let grad = this.computeGradient(x);
    let f = this.evaluate(x);
    
    let bestParams = { ...params };
    let bestFitness = f;
    
    this.history = [];

    if (!this.quiet) {
      console.log(`L-BFGS: Starting optimization...`);
      console.log(`  Dimensions: ${this.dim}, Memory: ${this.m}`);
      console.log(`  Initial fitness: ${f.toFixed(4)}`);
    }

    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      // Compute search direction using L-BFGS two-loop recursion
      const q = [...grad];
      const alpha: number[] = [];
      
      // First loop
      for (let i = this.history.length - 1; i >= 0; i--) {
        const state = this.history[i];
        const ai = state.rho * this.dotProduct(state.s, q);
        alpha.push(ai);
        for (let j = 0; j < this.dim; j++) {
          q[j] -= ai * state.y[j];
        }
      }
      
      // Initial Hessian approximation (scaled identity)
      let r: number[];
      if (this.history.length > 0) {
        const lastState = this.history[this.history.length - 1];
        const gamma = this.dotProduct(lastState.s, lastState.y) / 
                      this.dotProduct(lastState.y, lastState.y);
        r = q.map(qi => gamma * qi);
      } else {
        r = q.map(qi => qi); // Identity
      }
      
      // Second loop
      for (let i = 0; i < this.history.length; i++) {
        const state = this.history[this.history.length - 1 - i];
        const beta = state.rho * this.dotProduct(state.y, r);
        const ai = alpha[this.history.length - 1 - i];
        for (let j = 0; j < this.dim; j++) {
          r[j] += state.s[j] * (ai - beta);
        }
      }
      
      // r is now the search direction (negative gradient in quasi-Newton)
      const direction = r.map(ri => -ri);
      
      // Line search
      const stepSize = this.lineSearch(x, direction, f, grad);
      
      // Update position
      const newX = x.map((xi, i) => xi + stepSize * direction[i]);
      
      // Enforce constraints
      for (let i = 0; i < this.dim; i++) {
        const key = this.paramNames[i];
        const config = this.paramConfigs[key];
        newX[i] = Math.max(0, Math.min(1, newX[i])); // Keep normalized
      }
      
      const newF = this.evaluate(newX);
      const newGrad = this.computeGradient(newX);
      
      // Update L-BFGS history
      const s = newX.map((newXi, i) => newXi - x[i]);
      const y = newGrad.map((newGi, i) => newGi - grad[i]);
      const sy = this.dotProduct(s, y);
      
      if (sy > 1e-10) { // Only update if curvature condition satisfied
        this.history.push({
          s,
          y,
          rho: 1 / sy,
        });
        
        if (this.history.length > this.m) {
          this.history.shift();
        }
      }
      
      // Update best
      if (newF > bestFitness) {
        bestFitness = newF;
        bestParams = this.vectorToParams(newX);
      }
      
      // Save to history
      history.push({
        iteration: iter,
        params: { ...this.vectorToParams(newX) },
        sharpeRatio: newF,
      });
      
      if (!this.quiet && iter % 10 === 0) {
        console.log(`Iteration ${iter}: Best = ${bestFitness.toFixed(4)}, Current = ${newF.toFixed(4)}`);
      }
      
      // Check convergence
      const gradNorm = Math.sqrt(grad.reduce((sum, g) => sum + g * g, 0));
      if (gradNorm < this.config.convergenceThreshold && iter > 10) {
        if (!this.quiet) {
          console.log(`L-BFGS: Converged after ${iter + 1} iterations`);
        }
        break;
      }
      
      x = newX;
      f = newF;
      grad = newGrad;
    }

    return {
      finalParams: bestParams,
      bestSharpe: bestFitness,
      history,
      iterations: history.length,
      converged: history.length < this.config.maxIterations,
    };
  }

  private lineSearch(x: number[], direction: number[], f: number, grad: number[]): number {
    // Simple backtracking line search
    let alpha = 1.0;
    const c = 0.5;
    const rho = 0.5;
    const maxIter = 20;
    
    const gradDir = this.dotProduct(grad, direction);
    
    for (let i = 0; i < maxIter; i++) {
      const newX = x.map((xi, j) => xi + alpha * direction[j]);
      
      // Check bounds
      let outOfBounds = false;
      for (let j = 0; j < this.dim; j++) {
        if (newX[j] < 0 || newX[j] > 1) {
          outOfBounds = true;
          break;
        }
      }
      
      if (!outOfBounds) {
        const newF = this.evaluate(newX);
        
        // Armijo condition
        if (newF >= f + c * alpha * gradDir) {
          return alpha;
        }
      }
      
      alpha *= rho;
    }
    
    return alpha;
  }

  private computeGradient(x: number[]): number[] {
    const grad: number[] = [];
    const h = 0.01; // Step size for finite differences
    const f = this.evaluate(x);
    
    for (let i = 0; i < this.dim; i++) {
      const xPlus = [...x];
      xPlus[i] = Math.min(1, x[i] + h);
      
      const fPlus = this.evaluate(xPlus);
      grad[i] = (fPlus - f) / (xPlus[i] - x[i]);
    }
    
    return grad;
  }

  private evaluate(x: number[]): number {
    const params = this.vectorToParams(x);
    const strategy = new this.strategyClass(params);
    const engine = new BacktestEngine(this.data, strategy, { feeRate: 0.002 });

    const originalLog = console.log;
    if (this.quiet) {
      console.log = () => {};
    }

    try {
      const result = engine.run();
      // Use Sharpe ratio with penalty for low trade count
      const minTrades = 5;
      const tradePenalty = result.totalTrades < minTrades ? result.totalTrades / minTrades : 1;
      return result.sharpeRatio * tradePenalty;
    } finally {
      console.log = originalLog;
    }
  }

  private paramsToVector(params: Record<string, number>): number[] {
    return this.paramNames.map(key => {
      const config = this.paramConfigs[key];
      return (params[key] - config.min) / (config.max - config.min);
    });
  }

  private vectorToParams(normalized: number[]): Record<string, number> {
    const params: Record<string, number> = {};
    this.paramNames.forEach((key, i) => {
      const config = this.paramConfigs[key];
      let value = normalized[i] * (config.max - config.min) + config.min;
      value = Math.max(config.min, Math.min(config.max, value));
      if (config.stepSize >= 1) {
        value = Math.round(value / config.stepSize) * config.stepSize;
      }
      params[key] = value;
    });
    return params;
  }

  private getDefaultParams(): Record<string, number> {
    const defaults: Record<string, number> = {};
    for (const [key, config] of Object.entries(this.paramConfigs)) {
      defaults[key] = (config.min + config.max) / 2;
    }
    return defaults;
  }

  private dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  }
}
