import { loadStoredData } from '../src/backtest/engine';
import { SimpleMAStrategy, type SimpleMAStrategyParams } from '../src/strategies/example';
import { GradientDescentOptimizer } from '../src/optimization/gradient-descent';
import type { ParamConfig } from '../src/optimization/types';

const paramConfigs: Record<string, ParamConfig> = {
  fast_period: { min: 5, max: 500, stepSize: 1, learningRate: 0.5 },
  slow_period: { min: 10, max: 500, stepSize: 1, learningRate: 0.5 },
  stop_loss: { min: 0.001, max: 0.5, stepSize: 0.001, learningRate: 0.01 },
  trailing_stop: { min: 0, max: 1, stepSize: 1, learningRate: 0.1 },
  risk_percent: { min: 0.01, max: 1.0, stepSize: 0.01, learningRate: 0.01 },
};

function parseArgs(): { maxIterations: number; convergenceThreshold: number; dataFile: string } {
  const args = process.argv.slice(2);
  let maxIterations = 100;
  let convergenceThreshold = 1e-4;
  let dataFile = 'data/polymarket.bson';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-iterations' && args[i + 1]) {
      maxIterations = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--convergence-threshold' && args[i + 1]) {
      convergenceThreshold = parseFloat(args[i + 1]);
      i++;
    } else if (args[i] === '--data' && args[i + 1]) {
      dataFile = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: bun run scripts/run-optimization.ts [options]

Options:
  --max-iterations <n>       Maximum iterations (default: 100)
  --convergence-threshold <t> Convergence threshold (default: 1e-4)
  --data <file>              Data file path (default: data.polymarket.bson)
  --help, -h                 Show this help
`);
      process.exit(0);
    }
  }

  return { maxIterations, convergenceThreshold, dataFile };
}

async function main() {
  const { maxIterations, convergenceThreshold, dataFile } = parseArgs();

  console.log('Loading data from:', dataFile);
  const data = loadStoredData(dataFile);
  console.log(`Loaded ${data.markets.length} markets`);

  const optimizer = new GradientDescentOptimizer(
    data,
    SimpleMAStrategy,
    paramConfigs,
    { maxIterations, convergenceThreshold }
  );

  const existingParams = optimizer.loadParams('example');
  if (existingParams) {
    console.log('\nWarm starting from existing params:', existingParams);
  }

  console.log('\n--- Starting Optimization ---\n');
  
  const result = optimizer.optimize(existingParams);

  console.log('\n--- Optimization Complete ---');
  console.log(`Iterations: ${result.iterations}`);
  console.log(`Converged: ${result.converged}`);
  console.log(`Best Sharpe Ratio: ${result.bestSharpe.toFixed(4)}`);
  console.log('\nOptimized Parameters:');
  
  for (const [key, value] of Object.entries(result.finalParams)) {
    const config = paramConfigs[key];
    if (config.stepSize === 1 && config.min === 0 && config.max === 1) {
      console.log(`  ${key}: ${value === 1 ? 'true' : 'false'}`);
    } else if (key === 'stop_loss' || key === 'risk_percent') {
      console.log(`  ${key}: ${value.toFixed(4)} (${(value * 100).toFixed(2)}%)`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  }

  optimizer.saveParams('example', result.finalParams, result.bestSharpe);
}

main().catch(console.error);
