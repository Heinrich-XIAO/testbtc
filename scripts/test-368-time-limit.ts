import { loadStoredData, BacktestEngine } from '../src/backtest/engine';
import { SRNoTrendFilter302Strategy } from '../src/strategies/strat_sr_no_trend_filter_302';
import { SRNoTrendNoTimeLimit368Strategy } from '../src/strategies/strat_sr_no_trend_no_time_limit_368';
import * as fs from 'fs';
import * as path from 'path';

function loadSavedParams(paramsFile: string): Record<string, number> | null {
  const paramsPath = path.join(process.cwd(), paramsFile);
  if (!fs.existsSync(paramsPath)) return null;
  try {
    const content = fs.readFileSync(paramsPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function main() {
  const data = loadStoredData('data/test-data.bson');
  console.log(`Loaded ${data.markets.length} markets, ${data.priceHistory.size} tokens\n`);

  const baseParams = loadSavedParams('src/strategies/strat_sr_no_trend_filter_302.params.json') || {};

  console.log('Strategy'.padEnd(30) + 'Final Capital'.padEnd(15) + 'Return'.padEnd(15) + 'Drawdown'.padEnd(12) + 'Win Rate');
  console.log('-'.repeat(90));

  const base = new SRNoTrendFilter302Strategy(baseParams);
  const baseEngine = new BacktestEngine(data, base, { initialCapital: 1000, feeRate: 0 });
  const baseResult = baseEngine.run();
  const baseWR = baseResult.totalTrades > 0
    ? ((baseResult.winningTrades / (baseResult.winningTrades + baseResult.losingTrades)) * 100).toFixed(1) + '%'
    : '-';
  console.log('302 (Base)'.padEnd(30) +
    ('$' + baseResult.finalCapital.toFixed(2)).padEnd(15) +
    ('$' + baseResult.totalReturn.toFixed(2)).padEnd(15) +
    ('-' + baseResult.maxDrawdown.toFixed(2) + '%').padEnd(12) +
    baseWR);

  const newParams = { ...baseParams, max_hold_bars: 999 };
  const strategy = new SRNoTrendNoTimeLimit368Strategy(newParams);
  const engine = new BacktestEngine(data, strategy, { initialCapital: 1000, feeRate: 0 });
  const result = engine.run();

  const winRate = result.totalTrades > 0
    ? ((result.winningTrades / (result.winningTrades + result.losingTrades)) * 100).toFixed(1) + '%'
    : '-';

  const diff = result.totalReturn - baseResult.totalReturn;
  const diffStr = diff >= 0 ? '+$' + diff.toFixed(2) : '-$' + Math.abs(diff).toFixed(2);

  const row = '368 (No Time Limit)'.padEnd(30) +
    ('$' + result.finalCapital.toFixed(2)).padEnd(15) +
    ('$' + result.totalReturn.toFixed(2)).padEnd(15) +
    ('-' + result.maxDrawdown.toFixed(2) + '%').padEnd(12) +
    winRate;

  console.log(row);
  console.log('\nDiff: ' + diffStr);
}

main().catch(console.error);
