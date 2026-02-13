import type { Strategy, StoredData, PricePoint } from '../types';
import { BacktestEngine } from '../backtest/engine';
import type { OptimizationConfig, ParamConfig, OptimizationResult, OptimizationHistory } from './types';
import cliProgress from 'cli-progress';

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
  private F: number;
  private CR: number;

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
      randomSamples: config.randomSamples ?? 50,
    };
    
    this.paramNames = Object.keys(paramConfigs);
    this.dim = this.paramNames.length;
    
    this.populationSize = Math.max(10, this.dim + 1);
    this.F = 0.8;
    this.CR = 0.9;
  }

  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  async optimize(initialParams?: Record<string, number> | null): Promise<OptimizationResult> {
    const history: OptimizationHistory[] = [];
    let converged = false;

    const numRandomSamples = this.config.randomSamples;

    if (!this.quiet) {
      console.log(`DE: Random search phase (` + numRandomSamples + ` samples)...`);
    }

    const randomSamples: Individual[] = [];
    for (let i = 0; i < numRandomSamples; i++) {
      const params = this.sampleRandomParams();
      randomSamples.push({
        params,
        fitness: this.evaluate(params),
      });
    }

    randomSamples.sort((a, b) => b.fitness - a.fitness);
    
    if (!this.quiet) {
      console.log(`  Best random: ${randomSamples[0].fitness.toFixed(4)}`);
    }

    let population: Individual[] = [];
    
    population.push({ ...randomSamples[0] });
    if (this.populationSize > 1) {
      population.push({ ...randomSamples[1] });
    }

    while (population.length < this.populationSize) {
      const params = this.sampleRandomParams();
      population.push({
        params,
        fitness: this.evaluate(params),
      });
    }

    if (!this.quiet) {
      console.log(`DE: Starting differential evolution...`);
      console.log(`  Dimensions: ${this.dim}, Population: ${this.populationSize}`);
      console.log(`  F: ${this.F}, CR: ${this.CR}`);
    }

    const progressBar = !this.quiet ? new cliProgress.SingleBar({
      format: 'Generation {bar} {percentage}% | Gen: {value}/{total} | Best: {sharpe}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    }) : null;

    if (progressBar) {
      progressBar.start(this.config.maxIterations, 0, { sharpe: '0.0000' });
    }

    for (let generation = 0; generation < this.config.maxIterations; generation++) {
      const newPopulation: Individual[] = [];
      let bestInGeneration = population[0];
      let improvedInGen = false;

      for (let i = 0; i < this.populationSize; i++) {
        const candidates = population.map((_, idx) => idx).filter(idx => idx !== i);
        const [r1, r2, r3] = this.shuffleArray(candidates).slice(0, 3);

        const mutant: Record<string, number> = {};
        for (const key of this.paramNames) {
          const config = this.paramConfigs[key];
          const xr1 = population[r1].params[key];
          const xr2 = population[r2].params[key];
          const xr3 = population[r3].params[key];
          
          let mutantValue = xr1 + this.F * (xr2 - xr3);
          
          if (mutantValue < config.min) {
            mutantValue = config.min + Math.random() * (config.max - config.min);
          } else if (mutantValue > config.max) {
            mutantValue = config.min + Math.random() * (config.max - config.min);
          }
          
          if (config.stepSize >= 1) {
            mutantValue = Math.round(mutantValue / config.stepSize) * config.stepSize;
          }
          
          mutant[key] = mutantValue;
        }

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

        const trialFitness = this.evaluate(trial);
        
        if (trialFitness >= population[i].fitness) {
          newPopulation.push({ params: trial, fitness: trialFitness });
          if (trialFitness > population[i].fitness) {
            improvedInGen = true;
          }
        } else {
          newPopulation.push(population[i]);
        }

        if (trialFitness > bestInGeneration.fitness) {
          bestInGeneration = { params: trial, fitness: trialFitness };
        }
      }

      population = newPopulation;

      if (progressBar) {
        progressBar.update(generation + 1, { sharpe: bestInGeneration.fitness.toFixed(4) });
      }

      history.push({
        iteration: generation,
        params: { ...bestInGeneration.params },
        sharpeRatio: bestInGeneration.fitness,
      });

      if (!improvedInGen && generation > 20) {
        const recentHistory = history.slice(-20);
        const maxFit = Math.max(...recentHistory.map(h => h.sharpeRatio));
        const minFit = Math.min(...recentHistory.map(h => h.sharpeRatio));
        
        if (maxFit - minFit < this.config.convergenceThreshold) {
          converged = true;
          if (!this.quiet) {
            console.log(`\nDE: Converged after ${generation + 1} generations`);
          }
          break;
        }
      }
    }

    const bestIndividual = population.reduce((best, current) => 
      current.fitness > best.fitness ? current : best
    );

    if (progressBar) {
      progressBar.stop();
    }

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
