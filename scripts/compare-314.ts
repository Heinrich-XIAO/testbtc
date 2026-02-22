import { loadStoredData, BacktestEngine } from '../src/backtest/engine';
import { SRNoTrendFilter302Strategy } from '../src/strategies/strat_sr_no_trend_filter_302';
import { SRNoTrendRSIExit314Strategy } from '../src/strategies/strat_sr_no_trend_rsi_exit_314';
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

  const strategies = [
    {
      name: '302 (Base)',
      class: SRNoTrendFilter302Strategy,
      paramsFile: 'src/strategies/strat_sr_no_trend_filter_302.params.json',
    },
    {
      name: '314 (RSI Exit)',
      class: SRNoTrendRSIExit314Strategy,
      paramsFile: 'src/strategies/strat_sr_no_trend_rsi_exit_314.params.json',
    },
  ];

  console.log('Strategy'.padEnd(25) + 'Final Capital'.padEnd(15) + 'Return'.padEnd(15) + 'Drawdown'.padEnd(12) + 'Sharpe'.padEnd(10) + 'Trades'.padEnd(8) + 'Win Rate');
  console.log('-'.repeat(100));

  for (const s of strategies) {
    const savedParams = loadSavedParams(s.paramsFile);
    const strategy = new s.class(savedParams || {});
    const engine = new BacktestEngine(data, strategy, { initialCapital: 1000, feeRate: 0 });
    const result = engine.run();

    const winRate = result.totalTrades > 0
      ? ((result.winningTrades / (result.winningTrades + result.losingTrades)) * 100).toFixed(1) + '%'
      : '-';

    const row = s.name.padEnd(25) +
      ('$' + result.finalCapital.toFixed(2)).padEnd(15) +
      ('$' + result.totalReturn.toFixed(2) + ' (' + result.totalReturnPercent.toFixed(2) + '%)').padEnd(15) +
      ('-' + result.maxDrawdown.toFixed(2) + '%').padEnd(12) +
      result.sharpeRatio.toFixed(3).padEnd(10) +
      result.totalTrades.toString().padEnd(8) +
      winRate;

    console.log(row);
  }
}

main().catch(console.error);
