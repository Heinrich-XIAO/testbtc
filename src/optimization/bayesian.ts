import type { Strategy, StoredData, StrategyParams, PricePoint } from '../types';
import { BacktestEngine } from '../backtest/engine';
import type { OptimizationConfig, ParamConfig, OptimizationResult, OptimizationHistory, SavedParams } from './types';
import * as fs from 'fs';
import * as path from 'path';

interface EvaluatedPoint {
  params: Record<string, number>;
  score: number;
  stability: number;
}

interface CrossValidationFold {
  train: StoredData;
  val: StoredData;
}

export class BayesianOptimizer {
  private data: StoredData;
  private strategyClass: new (params: Partial<Record<string, number>>) => Strategy;
  private paramConfigs: Record<string, ParamConfig>;
  private config: OptimizationConfig;
  private quiet: boolean = false;
  private evaluatedPoints: EvaluatedPoint[] = [];
  private bestPoint: EvaluatedPoint | null = null;
  private cvFolds: CrossValidationFold[] = [];

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
      maxIterations: config.maxIterations ?? 50,
      convergenceThreshold: config.convergenceThreshold ?? 0.001,
      learningRate: config.learningRate ?? 1.0,
    };
    this.createCVFolds(5);
  }

  private createCVFolds(k: number): void {
    // Get all timestamps from price history
    const allTimestamps: number[] = [];
    for (const history of this.data.priceHistory.values()) {
      for (const point of history) {
        allTimestamps.push(point.t);
      }
    }
    
    allTimestamps.sort((a, b) => a - b);
    const foldSize = Math.floor(allTimestamps.length / k);
    const folds: number[][] = [];
    
    for (let i = 0; i < k; i++) {
      const start = i * foldSize;
      const end = i === k - 1 ? allTimestamps.length : (i + 1) * foldSize;
      folds.push(allTimestamps.slice(start, end));
    }
    
    this.cvFolds = [];
    for (let i = 0; i < k; i++) {
      const valTimestamps = new Set(folds[i]);
      const trainPriceHistory = new Map<string, PricePoint[]>();
      const valPriceHistory = new Map<string, PricePoint[]>();
      
      for (const [tokenId, history] of this.data.priceHistory) {
        const trainPoints: PricePoint[] = [];
        const valPoints: PricePoint[] = [];
        
        for (const point of history) {
          if (valTimestamps.has(point.t)) {
            valPoints.push(point);
          } else {
            trainPoints.push(point);
          }
        }
        
        if (trainPoints.length > 0) {
          trainPriceHistory.set(tokenId, trainPoints);
        }
        if (valPoints.length > 0) {
          valPriceHistory.set(tokenId, valPoints);
        }
      }
      
      this.cvFolds.push({
        train: {
          markets: this.data.markets,
          priceHistory: trainPriceHistory,
          collectionMetadata: this.data.collectionMetadata,
        },
        val: {
          markets: this.data.markets,
          priceHistory: valPriceHistory,
          collectionMetadata: this.data.collectionMetadata,
        },
      });
    }
  }

  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  optimize(initialParams?: Record<string, number> | null): OptimizationResult {
    this.evaluatedPoints = [];
    this.bestPoint = { params: {}, score: -Infinity, stability: 0 };

    // Initialize with random points or provided initial params
    const numInitialPoints = Math.min(5, this.config.maxIterations);
    
    if (initialParams) {
      this.evaluatePoint(initialParams);
    }

    // Random initialization
    for (let i = 0; i < numInitialPoints && this.evaluatedPoints.length < this.config.maxIterations; i++) {
      const randomParams = this.sampleRandomParams();
      this.evaluatePoint(randomParams);
    }

    if (!this.quiet) {
      console.log(`Initialized with ${this.evaluatedPoints.length} random points`);
      console.log(`Best score so far: ${this.bestPoint.score.toFixed(4)} (stability: ${(this.bestPoint.stability * 100).toFixed(1)}%)`);
    }

    // Bayesian optimization loop
    for (let iter = this.evaluatedPoints.length; iter < this.config.maxIterations; iter++) {
      // Fit GP model and find next point using acquisition function
      const nextParams = this.suggestNextParams();
      
      // Check if we've already evaluated this point
      const alreadyEvaluated = this.evaluatedPoints.some(
        p => this.paramDistance(p.params, nextParams) < 0.001
      );
      
      if (alreadyEvaluated) {
        // If we're stuck, add more random exploration
        const randomParams = this.sampleRandomParams();
        this.evaluatePoint(randomParams);
      } else {
        this.evaluatePoint(nextParams);
      }

      if (!this.quiet && (iter + 1) % 10 === 0) {
        console.log(`Iteration ${iter + 1}: Best score = ${this.bestPoint.score.toFixed(4)} (stability: ${(this.bestPoint.stability * 100).toFixed(1)}%)`);
      }
    }

    const history: OptimizationHistory[] = this.evaluatedPoints.map((p, i) => ({
      iteration: i,
      params: p.params,
      sharpeRatio: p.score,
    }));

    return {
      finalParams: this.bestPoint.params,
      bestSharpe: this.bestPoint.score,
      history,
      iterations: this.evaluatedPoints.length,
      converged: true,
    };
  }

  private sampleRandomParams(): Record<string, number> {
    const params: Record<string, number> = {};
    for (const [key, config] of Object.entries(this.paramConfigs)) {
      const range = config.max - config.min;
      params[key] = config.min + Math.random() * range;
      
      // Round to step size
      if (config.stepSize >= 1) {
        params[key] = Math.round(params[key] / config.stepSize) * config.stepSize;
      } else {
        const decimals = -Math.floor(Math.log10(config.stepSize));
        params[key] = Math.round(params[key] * Math.pow(10, decimals)) / Math.pow(10, decimals);
      }
    }
    return params;
  }

  private evaluatePoint(params: Record<string, number>): void {
    const { score, stability } = this.runCrossValidation(params);
    const point = { params, score, stability };
    this.evaluatedPoints.push(point);
    
    if (!this.bestPoint || score > this.bestPoint.score) {
      this.bestPoint = point;
    }
  }

  private runCrossValidation(params: Record<string, number>): { score: number; stability: number } {
    const returns: number[] = [];
    const sharpes: number[] = [];
    const tradeCounts: number[] = [];
    
    for (const fold of this.cvFolds) {
      const strategy = new this.strategyClass(params);
      // Use realistic fees (0.2% per trade) to prevent overfitting to noise
      const engine = new BacktestEngine(fold.val, strategy, { feeRate: 0.002 });
      
      const originalLog = console.log;
      if (this.quiet) {
        console.log = () => {};
      }
      
      try {
        const result = engine.run();
        returns.push(result.totalReturn);
        sharpes.push(result.sharpeRatio);
        tradeCounts.push(result.totalTrades);
      } finally {
        console.log = originalLog;
      }
    }
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const avgSharpe = sharpes.reduce((a, b) => a + b, 0) / sharpes.length;
    const avgTrades = tradeCounts.reduce((a, b) => a + b, 0) / tradeCounts.length;
    
    // Calculate stability as 1 - coefficient of variation
    const mean = avgReturn;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const cv = mean !== 0 ? Math.sqrt(variance) / Math.abs(mean) : 0;
    const stability = Math.max(0, 1 - Math.min(cv, 1));
    
    // Penalize strategies with too few trades (overfitting to rare events)
    const minTrades = 5;
    const tradePenalty = avgTrades < minTrades ? avgTrades / minTrades : 1;
    
    // Score combines Sharpe ratio with stability and trade penalty
    // Heavily weight stability to prevent overfitting
    const score = avgSharpe * (0.2 + 0.8 * stability) * tradePenalty;
    
    return { score, stability };
  }

  private suggestNextParams(): Record<string, number> {
    // Use Expected Improvement acquisition function
    const numCandidates = 100;
    let bestCandidate: Record<string, number> | null = null;
    let bestAcquisition = -Infinity;

    for (let i = 0; i < numCandidates; i++) {
      const candidate = this.sampleRandomParams();
      const acquisition = this.expectedImprovement(candidate);
      
      if (acquisition > bestAcquisition) {
        bestAcquisition = acquisition;
        bestCandidate = candidate;
      }
    }

    return bestCandidate!;
  }

  private expectedImprovement(params: Record<string, number>): number {
    if (this.evaluatedPoints.length === 0) return 0;
    
    const { mean, variance } = this.gpPredict(params);
    const std = Math.sqrt(variance);
    
    if (std < 1e-6) return 0;
    
    const bestScore = this.bestPoint?.score ?? -Infinity;
    const improvement = mean - bestScore;
    const z = improvement / std;
    
    // Expected Improvement formula
    const ei = improvement * this.normalCDF(z) + std * this.normalPDF(z);
    
    return ei;
  }

  private gpPredict(params: Record<string, number>): { mean: number; variance: number } {
    if (this.evaluatedPoints.length === 0) {
      return { mean: 0, variance: 1 };
    }

    const lengthScale = 0.1;
    const noise = 0.01;

    // Compute kernel matrix
    const K: number[][] = [];
    const y: number[] = [];
    
    for (let i = 0; i < this.evaluatedPoints.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < this.evaluatedPoints.length; j++) {
        const dist = this.paramDistance(
          this.evaluatedPoints[i].params,
          this.evaluatedPoints[j].params
        );
        row.push(Math.exp(-dist / (2 * lengthScale * lengthScale)));
      }
      K.push(row);
      y.push(this.evaluatedPoints[i].score);
    }

    // Add noise to diagonal
    for (let i = 0; i < K.length; i++) {
      K[i][i] += noise;
    }

    // Compute k_star (kernel between test point and training points)
    const kStar: number[] = [];
    for (const point of this.evaluatedPoints) {
      const dist = this.paramDistance(params, point.params);
      kStar.push(Math.exp(-dist / (2 * lengthScale * lengthScale)));
    }

    // Solve K * alpha = y
    const alpha = this.solveLinearSystem(K, y);

    // Predict mean: k_star^T * alpha
    let mean = 0;
    for (let i = 0; i < kStar.length; i++) {
      mean += kStar[i] * alpha[i];
    }

    // Predict variance
    let kStarStar = 1; // Kernel of point with itself
    let variance = kStarStar;
    
    // Solve K * v = k_star
    const v = this.solveLinearSystem(K, kStar);
    
    for (let i = 0; i < kStar.length; i++) {
      variance -= kStar[i] * v[i];
    }

    return { mean, variance: Math.max(variance, 1e-6) };
  }

  private paramDistance(p1: Record<string, number>, p2: Record<string, number>): number {
    let sum = 0;
    let count = 0;
    for (const key of Object.keys(this.paramConfigs)) {
      const config = this.paramConfigs[key];
      const normalized1 = (p1[key] - config.min) / (config.max - config.min);
      const normalized2 = (p2[key] - config.min) / (config.max - config.min);
      sum += Math.pow(normalized1 - normalized2, 2);
      count++;
    }
    return sum / count;
  }

  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length;
    const x = new Array(n).fill(0);
    
    // Simple Gaussian elimination
    const aug: number[][] = A.map((row, i) => [...row, b[i]]);
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
          maxRow = k;
        }
      }
      [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
      
      // Eliminate
      for (let k = i + 1; k < n; k++) {
        const factor = aug[k][i] / aug[i][i];
        for (let j = i; j <= n; j++) {
          aug[k][j] -= factor * aug[i][j];
        }
      }
    }
    
    // Back substitution
    for (let i = n - 1; i >= 0; i--) {
      x[i] = aug[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= aug[i][j] * x[j];
      }
      x[i] /= aug[i][i];
    }
    
    return x;
  }

  private normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  private normalCDF(x: number): number {
    // Approximation of the standard normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1 + sign * y);
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
      // Use Sharpe ratio with penalty for low trade count to prevent overfitting
      const minTrades = 10;
      const tradePenalty = result.totalTrades < minTrades ? result.totalTrades / minTrades : 1;
      return result.sharpeRatio * tradePenalty;
    } finally {
      console.log = originalLog;
    }
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
