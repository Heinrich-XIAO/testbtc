import type { Strategy, StoredData, PricePoint } from '../types';
import { BacktestEngine } from '../backtest/engine';
import type { OptimizationConfig, ParamConfig, OptimizationResult, OptimizationHistory } from './types';

interface Individual {
  params: Record<string, number>;
  fitness: number;
}

export class DifferentialEvolutionOptimizer {
  private data: StoredData;
  private strategyClass: new (params: Partial<Record<string, number>>) => Strategy;
  private paramConfigs: Record<string, ParamConfig>;
  private config: OptimizationConfig;
  private quiet: boolean = false;
  private paramNames: string[];
  private dim: number;
  
  // DE parameters
  private populationSize: number;
  private F: number; // Differential weight
  private CR: number; // Crossover probability

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
    
    // DE parameters (standard values)
    this.populationSize = Math.max(20, 4 * this.dim);
    this.F = 0.8;
    this.CR = 0.9;
  }

  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  optimize(initialParams?: Record<string, number> | null): OptimizationResult {
    const history: OptimizationHistory[] = [];
    let converged = false;

    // Initialize population
    let population: Individual[] = [];
    
    if (initialParams) {
      population.push({
        params: { ...initialParams },
        fitness: this.evaluate(initialParams),
      });
    }

    while (population.length < this.populationSize) {
      const params = this.sampleRandomParams();
      population.push({
        params,
        fitness: this.evaluate(params),
      });
    }

    if (!this.quiet) {
      console.log(`DE: Starting optimization...`);
      console.log(`  Dimensions: ${this.dim}, Population: ${this.populationSize}`);
      console.log(`  F: ${this.F}, CR: ${this.CR}`);
    }

    for (let generation = 0; generation < this.config.maxIterations; generation++) {
      const newPopulation: Individual[] = [];
      let bestInGeneration = population[0];
      let improved = false;

      for (let i = 0; i < this.populationSize; i++) {
        // Select three random distinct individuals different from i
        const candidates = population.map((_, idx) => idx).filter(idx => idx !== i);
        const [r1, r2, r3] = this.shuffleArray(candidates).slice(0, 3);

        // Mutation: v = x_r1 + F * (x_r2 - x_r3)
        const mutant: Record<string, number> = {};
        for (const key of this.paramNames) {
          const config = this.paramConfigs[key];
          const xr1 = population[r1].params[key];
          const xr2 = population[r2].params[key];
          const xr3 = population[r3].params[key];
          
          let mutantValue = xr1 + this.F * (xr2 - xr3);
          
          // Ensure mutant is within bounds (reflection)
          if (mutantValue < config.min) {
            mutantValue = config.min + Math.random() * (config.max - config.min);
          } else if (mutantValue > config.max) {
            mutantValue = config.min + Math.random() * (config.max - config.min);
          }
          
          // Apply step size rounding
          if (config.stepSize >= 1) {
            mutantValue = Math.round(mutantValue / config.stepSize) * config.stepSize;
          }
          
          mutant[key] = mutantValue;
        }

        // Crossover: binomial crossover
        const trial: Record<string, number> = {};
        const jrand = Math.floor(Math.random() * this.dim);
        
        let j = 0;
        for (const key of this.paramNames) {
          if (Math.random() < this.CR || j === jrand) {
            trial[key] = mutant[key];
          } else {
            trial[key] = population[i].params[key];
          }
          j++;
        }

        // Selection
        const trialFitness = this.evaluate(trial);
        
        if (trialFitness >= population[i].fitness) {
          newPopulation.push({ params: trial, fitness: trialFitness });
          if (trialFitness > population[i].fitness) {
            improved = true;
          }
        } else {
          newPopulation.push(population[i]);
        }

        if (trialFitness > bestInGeneration.fitness) {
          bestInGeneration = { params: trial, fitness: trialFitness };
        }
      }

      population = newPopulation;

      // Save best for history
      history.push({
        iteration: generation,
        params: { ...bestInGeneration.params },
        sharpeRatio: bestInGeneration.fitness,
      });

      if (!this.quiet && generation % 10 === 0) {
        console.log(`Generation ${generation}: Best = ${bestInGeneration.fitness.toFixed(4)}`);
      }

      // Check convergence
      if (!improved && generation > 20) {
        const recentHistory = history.slice(-20);
        const maxFit = Math.max(...recentHistory.map(h => h.sharpeRatio));
        const minFit = Math.min(...recentHistory.map(h => h.sharpeRatio));
        
        if (maxFit - minFit < this.config.convergenceThreshold) {
          converged = true;
          if (!this.quiet) {
            console.log(`DE: Converged after ${generation + 1} generations`);
          }
          break;
        }
      }
    }

    // Find best individual
    const bestIndividual = population.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    );

    return {
      finalParams: bestIndividual.params,
      bestSharpe: bestIndividual.fitness,
      history,
      iterations: history.length,
      converged,
    };
  }

  private sampleRandomParams(): Record<string, number> {
    const params: Record<string, number> = {};
    for (const [key, config] of Object.entries(this.paramConfigs)) {
      const range = config.max - config.min;
      params[key] = config.min + Math.random() * range;
      
      if (config.stepSize >= 1) {
        params[key] = Math.round(params[key] / config.stepSize) * config.stepSize;
      }
    }
    return params;
  }

  private evaluate(params: Record<string, number>): number {
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

  private shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
