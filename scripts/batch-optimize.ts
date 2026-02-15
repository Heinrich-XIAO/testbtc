/**
 * Batch optimizer: runs `bun run optimize --deterministic-slow` for every strategy sequentially.
 * Saves results to data/batch-results.json with per-strategy test returns and trade counts.
 *
 * Usage:
 *   bun run scripts/batch-optimize.ts                     # optimize all 53
 *   bun run scripts/batch-optimize.ts --only ema_fast,roc_slow  # optimize specific ones
 *   bun run scripts/batch-optimize.ts --skip-existing     # skip strategies that already have .params.json
 *   bun run scripts/batch-optimize.ts --concurrency 2     # run 2 at a time (default 1)
 */

import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import kleur from 'kleur';

kleur.enabled = true;

function ensureCompiledOptimizerScript(): string {
  const cacheDir = path.join(process.cwd(), '.cache');
  const compiledPath = path.join(cacheDir, 'run-optimization.js');

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  execSync(
    `bun build scripts/run-optimization.ts --target bun --outfile ${compiledPath}`,
    { cwd: process.cwd(), stdio: 'ignore' }
  );

  return compiledPath;
}

// Get all strategy names by running --list-strategies
function getStrategyNames(optimizerScript: string): string[] {
  const raw = execSync(`bun ${optimizerScript} --list-strategies`, {
    encoding: 'utf-8',
    cwd: process.cwd(),
  });
  // Strip ANSI escape codes
  const output = raw.replace(/\x1b\[[0-9;]*m/g, '');
  const names: string[] = [];
  for (const line of output.split('\n')) {
    // Lines look like: "  strategy_name -> output_file.params.json"
    const match = line.match(/^\s+(\S+)\s+->/);
    if (match) names.push(match[1]);
  }
  return names;
}

interface StrategyResult {
  name: string;
  testReturn: number;
  trainReturn: number;
  fullReturn: number;
  testTrades: number;
  status: 'pass' | 'fail' | 'error' | 'suspicious';
  duration: number; // seconds
  error?: string;
}

interface BatchResults {
  timestamp: string;
  totalStrategies: number;
  completed: number;
  passed: number;
  failed: number;
  errors: number;
  suspicious: number;
  results: StrategyResult[];
}

function runOptimization(
  optimizerScript: string,
  strategyName: string,
  extraArgs: string[] = [],
  timeoutMs = 10 * 60 * 1000
): Promise<StrategyResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const args = [optimizerScript, '-s', strategyName, ...extraArgs];
    let finished = false;

    const proc = spawn('bun', args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timeoutHandle = setTimeout(() => {
      if (finished) return;
      finished = true;
      proc.kill('SIGTERM');
      resolve({
        name: strategyName,
        testReturn: 0,
        trainReturn: 0,
        fullReturn: 0,
        testTrades: 0,
        status: 'error',
        duration: (Date.now() - start) / 1000,
        error: `Timed out after ${(timeoutMs / 60000).toFixed(1)} minutes`,
      });
    }, timeoutMs);

    proc.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutHandle);
      const duration = (Date.now() - start) / 1000;

      if (code !== 0) {
        resolve({
          name: strategyName,
          testReturn: 0,
          trainReturn: 0,
          fullReturn: 0,
          testTrades: 0,
          status: 'error',
          duration,
          error: stderr.slice(-500) || stdout.slice(-500),
        });
        return;
      }

      // Parse output for results
      let testReturn = 0;
      let trainReturn = 0;
      let fullReturn = 0;
      let testTrades = 0;

      for (const line of stdout.split('\n')) {
        const testReturnMatch = line.match(/Test Return:\s*\$([+-]?[\d.]+)/);
        if (testReturnMatch) testReturn = parseFloat(testReturnMatch[1]);

        const trainReturnMatch = line.match(/Train Return:\s*\$([+-]?[\d.]+)/);
        if (trainReturnMatch) trainReturn = parseFloat(trainReturnMatch[1]);

        const fullReturnMatch = line.match(/Full Return:\s*\$([+-]?[\d.]+)/);
        if (fullReturnMatch) fullReturn = parseFloat(fullReturnMatch[1]);

        const tradesMatch = line.match(/Test Trades:\s*(\d+)/);
        if (tradesMatch) testTrades = parseInt(tradesMatch[1]);
      }

      let status: 'pass' | 'fail' | 'suspicious' = 'pass';
      if (testReturn <= 0) status = 'fail';
      else if (testReturn > 2000) status = 'suspicious';

      resolve({
        name: strategyName,
        testReturn,
        trainReturn,
        fullReturn,
        testTrades,
        status,
        duration,
      });
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf('--only');
  const skipExisting = args.includes('--skip-existing');
  const concurrencyIdx = args.indexOf('--concurrency');
  const concurrency = concurrencyIdx >= 0 ? parseInt(args[concurrencyIdx + 1]) : 1;
  const timeoutIdx = args.indexOf('--timeout-minutes');
  const timeoutMinutes = timeoutIdx >= 0 && args[timeoutIdx + 1] ? parseFloat(args[timeoutIdx + 1]) : 10;
  const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;
  const iterIdx = args.indexOf('--iterations');
  const attemptsIdx = args.indexOf('--attempts');

  const optimizerArgs: string[] = [];
  if (iterIdx >= 0 && args[iterIdx + 1]) {
    optimizerArgs.push('-i', args[iterIdx + 1]);
  }
  if (attemptsIdx >= 0 && args[attemptsIdx + 1]) {
    optimizerArgs.push('-a', args[attemptsIdx + 1]);
  }

  const optimizerScript = ensureCompiledOptimizerScript();
  console.log(kleur.cyan('Optimizer script: ') + optimizerScript);

  let strategyNames = getStrategyNames(optimizerScript);

  if (onlyIdx >= 0) {
    const onlyList = args[onlyIdx + 1].split(',');
    strategyNames = strategyNames.filter((n) => onlyList.includes(n));
  }

  if (skipExisting) {
    strategyNames = strategyNames.filter((name) => {
      // Check if a .params.json exists for this strategy
      const files = fs.readdirSync(path.join(process.cwd(), 'src', 'strategies'));
      const hasParams = files.some((f) => f.includes(name) && f.endsWith('.params.json'));
      return !hasParams;
    });
  }

  console.log(kleur.bold(kleur.cyan('\n' + '='.repeat(70))));
  console.log(kleur.bold(kleur.cyan('BATCH OPTIMIZATION')));
  console.log(kleur.bold(kleur.cyan('='.repeat(70))));
  console.log(kleur.cyan('Strategies to optimize: ') + strategyNames.length);
  console.log(kleur.cyan('Concurrency: ') + concurrency);
  console.log(kleur.cyan('Timeout: ') + timeoutMinutes + ' minutes/strategy');
  if (iterIdx >= 0 && args[iterIdx + 1]) {
    console.log(kleur.cyan('Iterations override: ') + args[iterIdx + 1] + ' per attempt');
  }
  if (attemptsIdx >= 0 && args[attemptsIdx + 1]) {
    console.log(kleur.cyan('Attempts override: ') + args[attemptsIdx + 1] + ' per strategy');
  }
  console.log('');

  const results: StrategyResult[] = [];

  // Load existing results if any
  const resultsPath = path.join(process.cwd(), 'data', 'batch-results.json');
  let existingResults: BatchResults | null = null;
  if (fs.existsSync(resultsPath)) {
    try {
      existingResults = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    } catch {}
  }

  // Run optimizations with a true worker pool (start new task as soon as one finishes)
  let nextIdx = 0;
  let completed = 0;
  const startTime = Date.now();

  function saveResults() {
    const batchOutput: BatchResults = {
      timestamp: new Date().toISOString(),
      totalStrategies: strategyNames.length,
      completed: results.length,
      passed: results.filter((r) => r.status === 'pass').length,
      failed: results.filter((r) => r.status === 'fail').length,
      errors: results.filter((r) => r.status === 'error').length,
      suspicious: results.filter((r) => r.status === 'suspicious').length,
      results,
    };
    fs.writeFileSync(resultsPath, JSON.stringify(batchOutput, null, 2));
  }

  function logResult(result: StrategyResult) {
    completed++;
    const icon =
      result.status === 'pass'
        ? kleur.green('PASS')
        : result.status === 'fail'
          ? kleur.red('FAIL')
          : result.status === 'suspicious'
            ? kleur.yellow('SUS?')
            : kleur.red('ERR!');

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const pct = ((completed / strategyNames.length) * 100).toFixed(0);

    console.log(
      `  [${completed}/${strategyNames.length} ${pct}% ${elapsed}s] ${icon} ${result.name.padEnd(20)} | Test: $${result.testReturn.toFixed(2).padStart(10)} | Trades: ${String(result.testTrades).padStart(5)} | ${result.duration.toFixed(1)}s`
    );

    if (result.error) {
      console.log(kleur.red(`    Error: ${result.error.slice(0, 100)}`));
    }
  }

  async function worker(): Promise<void> {
    while (nextIdx < strategyNames.length) {
      const idx = nextIdx++;
      const name = strategyNames[idx];
      const result = await runOptimization(optimizerScript, name, optimizerArgs, timeoutMs);
      results.push(result);
      logResult(result);
      // Save every 5 completions
      if (completed % 5 === 0) saveResults();
    }
  }

  // Launch worker pool
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, strategyNames.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  // Final save
  saveResults();

  // Final summary
  const passed = results.filter((r) => r.status === 'pass');
  const failed = results.filter((r) => r.status === 'fail');
  const errors = results.filter((r) => r.status === 'error');
  const suspicious = results.filter((r) => r.status === 'suspicious');

  console.log(kleur.bold(kleur.cyan('\n' + '='.repeat(70))));
  console.log(kleur.bold(kleur.cyan('BATCH RESULTS SUMMARY')));
  console.log(kleur.bold(kleur.cyan('='.repeat(70))));
  console.log(kleur.green(`  Passed:     ${passed.length}`));
  console.log(kleur.red(`  Failed:     ${failed.length}`));
  console.log(kleur.red(`  Errors:     ${errors.length}`));
  console.log(kleur.yellow(`  Suspicious: ${suspicious.length}`));
  console.log(kleur.cyan(`  Total:      ${results.length}`));

  if (passed.length > 0) {
    console.log(kleur.bold(kleur.green('\nTop performers:')));
    const sorted = [...passed].sort((a, b) => b.testReturn - a.testReturn);
    for (const r of sorted.slice(0, 10)) {
      console.log(
        `  ${r.name.padEnd(20)} | $${r.testReturn.toFixed(2).padStart(10)} | ${r.testTrades} trades`
      );
    }
  }

  if (failed.length > 0) {
    console.log(kleur.bold(kleur.red('\nFailed strategies:')));
    for (const r of failed) {
      console.log(`  ${r.name.padEnd(20)} | $${r.testReturn.toFixed(2).padStart(10)}`);
    }
  }

  if (errors.length > 0) {
    console.log(kleur.bold(kleur.red('\nError strategies:')));
    for (const r of errors) {
      console.log(`  ${r.name.padEnd(20)} | ${r.error?.slice(0, 80)}`);
    }
  }

  console.log(kleur.green('\nResults saved to data/batch-results.json'));
}

main().catch(console.error);
