import type { Strategy, StoredData, PricePoint } from '../types';
import { BacktestEngine } from '../backtest/engine';
import type { OptimizationConfig, ParamConfig, OptimizationResult, OptimizationHistory } from './types';

interface Individual {
  params: Record<string, number>;
  fitness: number;
}

export class CMAESOptimizer {
  private data: StoredData;
  private strategyClass: new (params: Partial<Record<string, number>>) => Strategy;
  private paramConfigs: Record<string, ParamConfig>;
  private config: OptimizationConfig;
  private quiet: boolean = false;
  private paramNames: string[];
  private dim: number;
  
  // CMA-ES state
  private populationSize: number;
  private mu: number;
  private weights: number[];
  private mueff: number;
  private cc: number;
  private cs: number;
  private c1: number;
  private cmu: number;
  private damps: number;
  
  private pc: number[];
  private ps: number[];
  private B: number[][];
  private D: number[];
  private C: number[][];
  private sigma: number;
  private chiN: number;
  private counteval: number;
  private xmean: number[];

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
    
    // CMA-ES parameters
    this.populationSize = 4 + Math.floor(3 * Math.log(this.dim));
    this.mu = Math.floor(this.populationSize / 2);
    
    // Recombination weights
    this.weights = [];
    for (let i = 0; i < this.mu; i++) {
      this.weights.push(Math.log(this.mu + 0.5) - Math.log(i + 1));
    }
    const sumWeights = this.weights.reduce((a, b) => a + b, 0);
    this.weights = this.weights.map(w => w / sumWeights);
    
    // Variance-effectiveness of sum w_i
    this.mueff = Math.pow(this.weights.reduce((a, b) => a + b, 0), 2) / 
                  this.weights.reduce((a, b) => a + b * b, 0);
    
    // Adaptation parameters
    this.cc = (4 + this.mueff / this.dim) / (this.dim + 4 + 2 * this.mueff / this.dim);
    this.cs = (this.mueff + 2) / (this.dim + this.mueff + 5);
    this.c1 = 2 / (Math.pow(this.dim + 1.3, 2) + this.mueff);
    this.cmu = Math.min(1 - this.c1, 2 * (this.mueff - 2 + 1 / this.mueff) / 
                        (Math.pow(this.dim + 2, 2) + this.mueff));
    this.damps = 1 + 2 * Math.max(0, Math.sqrt((this.mueff - 1) / (this.dim + 1)) - 1) + this.cs;
    
    // Initialize state
    this.pc = new Array(this.dim).fill(0);
    this.ps = new Array(this.dim).fill(0);
    this.B = this.identityMatrix(this.dim);
    this.D = new Array(this.dim).fill(1);
    this.C = this.identityMatrix(this.dim);
    this.sigma = 0.3;
    this.chiN = Math.sqrt(this.dim) * (1 - 1 / (4 * this.dim) + 1 / (21 * this.dim * this.dim));
    this.counteval = 0;
    this.xmean = this.paramNames.map(key => {
      const config = this.paramConfigs[key];
      return (config.min + config.max) / 2;
    });
  }

  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  optimize(initialParams?: Record<string, number> | null): OptimizationResult {
    if (initialParams) {
      this.xmean = this.paramNames.map(key => {
        const config = this.paramConfigs[key];
        return Math.max(config.min, Math.min(config.max, initialParams[key] ?? (config.min + config.max) / 2));
      });
    }

    const history: OptimizationHistory[] = [];
    let bestIndividual: Individual | null = null;
    let converged = false;

    if (!this.quiet) {
      console.log(`CMA-ES: Starting optimization...`);
      console.log(`  Dimensions: ${this.dim}, Population: ${this.populationSize}, Mu: ${this.mu}`);
    }

    for (let generation = 0; generation < this.config.maxIterations; generation++) {
      // Sample population
      const population: Individual[] = [];
      
      for (let i = 0; i < this.populationSize; i++) {
        // Sample from N(0, C)
        const z = this.sampleStandardNormal(this.dim);
        const y = this.matrixVectorMultiply(this.B, z.map((zi, idx) => zi * this.D[idx]));
        const x = y.map((yi, idx) => this.xmean[idx] + this.sigma * yi);
        
        const params = this.denormalizeParams(x);
        const fitness = this.evaluate(params);
        
        population.push({ params, fitness });
        this.counteval++;
        
        if (!bestIndividual || fitness > bestIndividual.fitness) {
          bestIndividual = { params, fitness };
        }
      }

      // Sort by fitness
      population.sort((a, b) => b.fitness - a.fitness);

      // Save best for history
      history.push({
        iteration: generation,
        params: { ...population[0].params },
        sharpeRatio: population[0].fitness,
      });

      if (!this.quiet && generation % 10 === 0) {
        console.log(`Generation ${generation}: Best = ${population[0].fitness.toFixed(4)}`);
      }

      // Update mean
      const oldMean = [...this.xmean];
      const arx = population.slice(0, this.mu).map(ind => this.normalizeParams(ind.params));
      this.xmean = new Array(this.dim).fill(0);
      for (let i = 0; i < this.mu; i++) {
        for (let j = 0; j < this.dim; j++) {
          this.xmean[j] += this.weights[i] * arx[i][j];
        }
      }

      // Cumulation: Update evolution paths
      const artmp = arx.map(x => x.map((xi, idx) => xi - oldMean[idx]));
      
      // ps = (1-cs)*ps + sqrt(cs*(2-cs)*mueff) * (mean_diff / sigma) * inv_sqrt_C
      const psUpdate = artmp.map((row, i) => 
        row.map((val, j) => val * this.weights[i] / this.sigma)
      ).reduce((sum, row) => sum.map((s, j) => s + row[j]), new Array(this.dim).fill(0));
      
      for (let i = 0; i < this.dim; i++) {
        this.ps[i] = (1 - this.cs) * this.ps[i] + 
                     Math.sqrt(this.cs * (2 - this.cs) * this.mueff) * psUpdate[i];
      }

      // pc = (1-cc)*pc + sqrt(cc*(2-cc)*mueff) * (mean_diff / sigma)
      const hsig = this.ps.reduce((sum, p) => sum + p * p, 0) / 
                   (1 - Math.pow(1 - this.cs, 2 * this.counteval / this.populationSize)) / this.dim < 
                   2 + 4 / (this.dim + 1) ? 1 : 0;
      
      for (let i = 0; i < this.dim; i++) {
        this.pc[i] = (1 - this.cc) * this.pc[i] + 
                     hsig * Math.sqrt(this.cc * (2 - this.cc) * this.mueff) * 
                     (this.xmean[i] - oldMean[i]) / this.sigma;
      }

      // Adapt covariance matrix C
      // Simplified update (full update would require more complex operations)
      // For simplicity, we skip the full C update and just update sigma
      
      // Adapt step size sigma
      this.sigma *= Math.exp((this.cs / this.damps) * 
                             (this.ps.reduce((sum, p) => sum + p * p, 0) / this.dim - 1) / 2);

      // Check convergence
      const maxChange = Math.max(...this.xmean.map((x, i) => Math.abs(x - oldMean[i])));
      if (maxChange < this.config.convergenceThreshold && generation > 20) {
        converged = true;
        if (!this.quiet) {
          console.log(`CMA-ES: Converged after ${generation + 1} generations`);
        }
        break;
      }
    }

    return {
      finalParams: bestIndividual!.params,
      bestSharpe: bestIndividual!.fitness,
      history,
      iterations: history.length,
      converged,
    };
  }

  private normalizeParams(params: Record<string, number>): number[] {
    return this.paramNames.map(key => {
      const config = this.paramConfigs[key];
      return (params[key] - config.min) / (config.max - config.min);
    });
  }

  private denormalizeParams(normalized: number[]): Record<string, number> {
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

  private sampleStandardNormal(dim: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < dim; i++) {
      // Box-Muller transform
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      result.push(z);
    }
    return result;
  }

  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    return matrix.map(row => 
      row.reduce((sum, val, i) => sum + val * vector[i], 0)
    );
  }

  private identityMatrix(n: number): number[][] {
    return Array.from({ length: n }, (_, i) => 
      Array.from({ length: n }, (_, j) => i === j ? 1 : 0)
    );
  }
}
