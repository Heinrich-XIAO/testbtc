import type { Strategy, StoredData, StrategyParams } from '../types';
import { BacktestEngine } from '../backtest/engine';
import type { OptimizationConfig, ParamConfig, OptimizationResult, OptimizationHistory, SavedParams } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class GradientDescentOptimizer {
  private data: StoredData;
  private strategyClass: new (params: Partial<Record<string, number>>) => Strategy;
  private paramConfigs: Record<string, ParamConfig>;
  private config: OptimizationConfig;
  private quiet: boolean = false;

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
      convergenceThreshold: config.convergenceThreshold ?? 1e-4,
    };
  }

  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  optimize(initialParams?: Record<string, number> | null): OptimizationResult {
    let params = initialParams ?? this.getDefaultParams();
    const history: OptimizationHistory[] = [];
    let bestSharpe = -Infinity;
    let bestParams = { ...params };
    let converged = false;

    if (!this.quiet) {
      console.log('Starting optimization...');
      console.log(`Max iterations: ${this.config.maxIterations}`);
      console.log(`Convergence threshold: ${this.config.convergenceThreshold}`);
      console.log(`Initial params:`, params);
    }

    for (let iter = 0; iter < this.config.maxIterations; iter++) {
      const sharpe = this.runBacktest(params);
      
      history.push({
        iteration: iter,
        params: { ...params },
        sharpeRatio: sharpe,
      });

      if (sharpe > bestSharpe) {
        bestSharpe = sharpe;
        bestParams = { ...params };
      }

      if (!this.quiet) {
        console.log(`\nIteration ${iter + 1}: Sharpe = ${sharpe.toFixed(4)}`);
      }

      const gradients = this.computeGradient(params);
      const newParams = this.updateParams(params, gradients);

      const maxChange = this.getMaxParamChange(params, newParams);
      if (maxChange < this.config.convergenceThreshold) {
        converged = true;
        if (!this.quiet) {
          console.log(`\nConverged after ${iter + 1} iterations (max change: ${maxChange.toFixed(6)})`);
        }
        break;
      }

      params = newParams;
    }

    return {
      finalParams: bestParams,
      bestSharpe,
      history,
      iterations: history.length,
      converged,
    };
  }

  private getDefaultParams(): Record<string, number> {
    const defaults: Record<string, number> = {};
    for (const [key, config] of Object.entries(this.paramConfigs)) {
      defaults[key] = (config.min + config.max) / 2;
    }
    return defaults;
  }

  private runBacktest(params: Record<string, number>): number {
    const strategy = new this.strategyClass(params);
    const engine = new BacktestEngine(this.data, strategy, { feeRate: 0 });
    
    const originalLog = console.log;
    if (this.quiet) {
      console.log = () => {};
    }
    
    try {
      const result = engine.run();
      return result.sharpeRatio;
    } finally {
      console.log = originalLog;
    }
  }

  private computeGradient(params: Record<string, number>): Record<string, number> {
    const gradients: Record<string, number> = {};
    const baseObjective = this.runBacktest(params);

    for (const key of Object.keys(this.paramConfigs)) {
      const config = this.paramConfigs[key];
      const perturbedParams = { ...params };
      perturbedParams[key] = Math.min(params[key] + config.stepSize, config.max);
      
      const perturbedObjective = this.runBacktest(perturbedParams);
      gradients[key] = (perturbedObjective - baseObjective) / config.stepSize;
    }

    return gradients;
  }

  private updateParams(params: Record<string, number>, gradients: Record<string, number>): Record<string, number> {
    const newParams: Record<string, number> = {};

    for (const key of Object.keys(params)) {
      const config = this.paramConfigs[key];
      newParams[key] = params[key] - config.learningRate * gradients[key];
    }

    return this.enforceConstraints(newParams);
  }

  private enforceConstraints(params: Record<string, number>): Record<string, number> {
    const constrained: Record<string, number> = {};

    for (const [key, value] of Object.entries(params)) {
      const config = this.paramConfigs[key];
      let clamped = Math.max(config.min, Math.min(config.max, value));

      if (config.stepSize === 1 && config.min === 0 && config.max === 1) {
        clamped = Math.round(clamped);
      }

      constrained[key] = clamped;
    }

    return constrained;
  }

  private getMaxParamChange(oldParams: Record<string, number>, newParams: Record<string, number>): number {
    let maxChange = 0;
    for (const key of Object.keys(oldParams)) {
      const change = Math.abs(newParams[key] - oldParams[key]);
      if (change > maxChange) {
        maxChange = change;
      }
    }
    return maxChange;
  }

  saveParams(strategyName: string, params: Record<string, number>, bestSharpe: number): void {
    const output: SavedParams = {
      ...params,
      metadata: {
        best_sharpe: bestSharpe,
        optimized_at: new Date().toISOString(),
      },
    };

    const strategyPath = this.findStrategyPath(strategyName);
    if (!strategyPath) {
      console.error(`Could not find strategy file for: ${strategyName}`);
      return;
    }

    const outputPath = strategyPath.replace('.ts', '.params.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    
    if (!this.quiet) {
      console.log(`\nSaved optimized params to: ${outputPath}`);
    }
  }

  private findStrategyPath(strategyName: string): string | null {
    const strategiesDir = path.join(process.cwd(), 'src', 'strategies');
    const files = fs.readdirSync(strategiesDir);
    
    for (const file of files) {
      if (file.includes(strategyName.toLowerCase()) || file === `${strategyName}.ts`) {
        return path.join(strategiesDir, file);
      }
    }
    
    return null;
  }

  loadParams(strategyName: string): Record<string, number> | null {
    const strategyPath = this.findStrategyPath(strategyName);
    if (!strategyPath) return null;

    const paramsPath = strategyPath.replace('.ts', '.params.json');
    if (!fs.existsSync(paramsPath)) return null;

    try {
      const content = fs.readFileSync(paramsPath, 'utf-8');
      const saved = JSON.parse(content) as SavedParams;
      const params: Record<string, number> = {};
      
      for (const [key, value] of Object.entries(saved)) {
        if (key !== 'metadata' && typeof value === 'number') {
          params[key] = value;
        }
      }
      
      return params;
    } catch {
      return null;
    }
  }
}
