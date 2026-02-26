import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import type { BacktestResult } from '../src/types';
import { StratGridStrategy } from '../src/strategies/strat_grid';

const lookbacks = [45, 48, 50, 52, 55];
const maxHolds = [28, 32, 35];
const resistanceExits = [true, false];
const stochOversolds = [14, 16, 18];

const smallDataPath = 'data/test-data.json';
const largeDataPath = 'data/test-data-15min-large.json';

interface TestResult {
  lookback: number;
  max_hold: number;
  resistance_exit: boolean;
  stoch_oversold: number;
  smallReturn: number;
  largeReturn: number;
  smallTrades: number;
  largeTrades: number;
  winRate: number;
}

function runBacktest(dataPath: string, params: any): BacktestResult {
  const data = loadStoredData(dataPath);
  const strategy = new StratGridStrategy(params);
  const config = { initialCapital: 1000, feeRate: 0, slippage: 0 };
  const engine = new BacktestEngine(data, strategy, config);
  return engine.run();
}

async function main() {
  console.log('Starting parameter grid search...\n');

  const results: TestResult[] = [];
  let comboIndex = 0;
  const totalCombos = lookbacks.length * maxHolds.length * resistanceExits.length * stochOversolds.length;

  for (const lookback of lookbacks) {
    for (const maxHold of maxHolds) {
      for (const resistanceExit of resistanceExits) {
        for (const stochOversold of stochOversolds) {
          comboIndex++;
          
          const params = {
            sr_lookback: lookback,
            stoch_lookback: lookback,
            max_hold_bars: maxHold,
            resistance_exit: resistanceExit,
            stoch_oversold: stochOversold,
            stoch_overbought: 100 - stochOversold,
            stop_loss: 0.08,
            profit_target: 0.18,
            risk_percent: 0.25,
            support_threshold: 0.01,
            resistance_threshold: 0.98,
          };

          console.log(`Testing combo ${comboIndex}/${totalCombos}: lb=${lookback}, mh=${maxHold}, re=${resistanceExit}, so=${stochOversold}`);

          const smallResult = runBacktest(smallDataPath, params);
          const largeResult = runBacktest(largeDataPath, params);

          const smallReturn = smallResult.totalReturnPercent;
          const largeReturn = largeResult.totalReturnPercent;
          const smallTrades = smallResult.totalTrades;
          const largeTrades = largeResult.totalTrades;
          
          const winningTrades = smallResult.winningTrades + largeResult.winningTrades;
          const totalTrades = smallResult.totalTrades + largeResult.totalTrades;
          const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

          results.push({
            lookback,
            max_hold: maxHold,
            resistance_exit: resistanceExit,
            stoch_oversold: stochOversold,
            smallReturn,
            largeReturn,
            smallTrades,
            largeTrades,
            winRate,
          });

          console.log(`  Small: ${smallReturn.toFixed(2)}% (${smallTrades} trades), Large: ${largeReturn.toFixed(2)}% (${largeTrades} trades)`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(120));
  console.log('RESULTS SUMMARY - Sorted by (Large - Small) descending (to find large > small)');
  console.log('='.repeat(120));

  const sortedResults = results
    .filter(r => r.smallTrades >= 15)
    .sort((a, b) => (b.largeReturn - b.smallReturn) - (a.largeReturn - a.smallReturn));

  console.log('\nIdx | Lookbk | MaxHold | ResExit | StochOS | Small%  | Large%  | Diff   | Small# | Large# | WinRate');
  console.log('-'.repeat(120));

  sortedResults.forEach((r, idx) => {
    const diff = r.largeReturn - r.smallReturn;
    console.log(
      `${(idx + 1).toString().padStart(3)} | ` +
      `${r.lookback.toString().padStart(7)} | ` +
      `${r.max_hold.toString().padStart(7)} | ` +
      `${(r.resistance_exit ? 'true ' : 'false').padStart(7)} | ` +
      `${r.stoch_oversold.toString().padStart(8)} | ` +
      `${r.smallReturn.toFixed(2).padStart(7)} | ` +
      `${r.largeReturn.toFixed(2).padStart(8)} | ` +
      `${diff.toFixed(2).padStart(6)} | ` +
      `${r.smallTrades.toString().padStart(6)} | ` +
      `${r.largeTrades.toString().padStart(6)} | ` +
      `${r.winRate.toFixed(1).padStart(6)}%`
    );
  });

  const topResults = sortedResults.slice(0, 21);
  
  console.log('\n' + '='.repeat(120));
  console.log('TOP 21 COMBINATIONS (for iterations 29-35, 7 strategies each)');
  console.log('='.repeat(120));
  
  topResults.forEach((r, idx) => {
    const iter = Math.floor(idx / 3) + 29;
    const strat = (idx % 3) + 1;
    console.log(`Iteration ${iter}, Strategy ${strat === 1 ? 'A' : strat === 2 ? 'B' : 'C'}: lookback=${r.lookback}, max_hold=${r.max_hold}, resistance_exit=${r.resistance_exit}, stoch_oversold=${r.stoch_oversold}`);
    console.log(`  Small: ${r.smallReturn.toFixed(2)}% (${r.smallTrades} trades), Large: ${r.largeReturn.toFixed(2)}% (${r.largeTrades} trades), Diff: ${(r.largeReturn - r.smallReturn).toFixed(2)}%`);
  });

  const bestCombo = sortedResults[0];
  console.log(`\n★ BEST COMBINATION: lookback=${bestCombo.lookback}, max_hold=${bestCombo.max_hold}, resistance_exit=${bestCombo.resistance_exit}, stoch_oversold=${bestCombo.stoch_oversold}`);
  console.log(`  Small: ${bestCombo.smallReturn.toFixed(2)}%, Large: ${bestCombo.largeReturn.toFixed(2)}%, Diff: ${(bestCombo.largeReturn - bestCombo.smallReturn).toFixed(2)}%`);
}

main().catch(console.error);
