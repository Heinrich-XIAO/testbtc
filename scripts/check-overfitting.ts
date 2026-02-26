import * as fs from 'fs';
import * as path from 'path';
import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import { SRNoTrendFilter302Strategy, SRNoTrendFilter302Params } from '../src/strategies/strat_sr_no_trend_filter_302';
import { SRNoTrendNoMomentum315Strategy, SRNoTrendNoMomentum315Params } from '../src/strategies/strat_sr_no_trend_no_momentum_315';
import type { StoredData, PricePoint } from '../src/types';

const STRATEGIES = [
  { name: 'sr_ntf_v18_019', file: 'strat_sr_ntf_v18_019.params.json' },
  { name: 'sr_ntf_v20_008', file: 'strat_sr_ntf_v20_008.params.json' },
  { name: 'sr_ntf_v21_022', file: 'strat_sr_ntf_v21_022.params.json' },
  { name: 'sr_ntf_v22_030', file: 'strat_sr_ntf_v22_030.params.json' },
  { name: 'sr_ntf_v24_005', file: 'strat_sr_ntf_v24_005.params.json' },
  { name: 'sr_ntf_315_no_momentum', strategy: 'no_momentum' as any },
];

const HYBRID_HIGH_RISK_PARAMS: Partial<SRNoTrendFilter302Params> = {
  base_lookback: 45,
  bounce_threshold: 0.0206,
  stoch_k_period: 18,
  stoch_d_period: 5,
  stop_loss: 0.066,
  risk_percent: 0.45,
  profit_target: 0.09,
};

function parseArgs(): { dataFile: string; ignoreParams: boolean; hybrid: boolean } {
  const args = process.argv.slice(2);
  let dataFile = 'data/test-data.json';
  let ignoreParams = false;
  let hybrid = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ignore-params') {
      ignoreParams = true;
    } else if (args[i] === '--hybrid') {
      hybrid = true;
    } else if (!args[i].startsWith('--')) {
      dataFile = args[i];
    }
  }
  
  return { dataFile, ignoreParams, hybrid };
}

function splitData(data: StoredData, trainRatio: number = 0.7): { train: StoredData; test: StoredData } {
  const allTimestamps: number[] = [];
  for (const history of data.priceHistory.values()) {
    for (const point of history) {
      allTimestamps.push(point.t);
    }
  }
  
  allTimestamps.sort((a, b) => a - b);
  const splitIndex = Math.floor(allTimestamps.length * trainRatio);
  const splitTime = allTimestamps[splitIndex];
  
  const trainPriceHistory = new Map<string, PricePoint[]>();
  const testPriceHistory = new Map<string, PricePoint[]>();
  
  for (const [tokenId, history] of data.priceHistory) {
    const trainPoints: PricePoint[] = [];
    const testPoints: PricePoint[] = [];
    
    for (const point of history) {
      if (point.t <= splitTime) {
        trainPoints.push(point);
      } else {
        testPoints.push(point);
      }
    }
    
    if (trainPoints.length > 0) {
      trainPriceHistory.set(tokenId, trainPoints);
    }
    if (testPoints.length > 0) {
      testPriceHistory.set(tokenId, testPoints);
    }
  }
  
  return {
    train: {
      markets: data.markets,
      priceHistory: trainPriceHistory,
      collectionMetadata: data.collectionMetadata,
    },
    test: {
      markets: data.markets,
      priceHistory: testPriceHistory,
      collectionMetadata: data.collectionMetadata,
    },
  };
}

async function main() {
  const { dataFile, ignoreParams, hybrid } = parseArgs();
  console.log(`Loading data from ${dataFile}...`);
  if (ignoreParams) console.log('--ignore-params: Using default parameters (ignoring saved params files)\n');
  if (hybrid) console.log('--hybrid: Using hybrid high-risk params (lookback=45, stoch_k=18, risk=45%)\n');
  const data = await loadStoredData(dataFile);
  
  const { train: trainData, test: testData } = splitData(data, 0.7);
  
  const trainPoints = Array.from(trainData.priceHistory.values()).reduce((sum, h) => sum + h.length, 0);
  const testPoints = Array.from(testData.priceHistory.values()).reduce((sum, h) => sum + h.length, 0);
  const totalPoints = Array.from(data.priceHistory.values()).reduce((sum, h) => sum + h.length, 0);
  
  console.log(`Total points: ${totalPoints}, Train: ${trainPoints}, Test: ${testPoints}\n`);
  
  console.log('| Strategy | Train Return | Test Return | Full Return | Train/Test | Test/Full | Train Trades | Test Trades | Train Sharpe | Test Sharpe | Overfit? |');
  console.log('|----------|-------------|-------------|-------------|------------|-----------|--------------|-------------|--------------|-------------|----------|');
  
  for (const s of STRATEGIES) {
    let params: SRNoTrendFilter302Params | SRNoTrendNoMomentum315Params | Record<string, never> = {};
    let useNoMomentum = false;
    
    if ('strategy' in s && s.strategy === 'no_momentum') {
      useNoMomentum = true;
    } else if (!ignoreParams && s.file) {
      const paramsPath = path.join(process.cwd(), 'src/strategies', s.file);
      if (!fs.existsSync(paramsPath)) {
        console.log(`| ${s.name} | FILE NOT FOUND | | | | | | | | | |`);
        continue;
      }
      params = hybrid 
        ? HYBRID_HIGH_RISK_PARAMS as any
        : ignoreParams 
          ? {} 
          : JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
    } else if (ignoreParams) {
      params = {};
    }
    
    const originalLog = console.log;
    console.log = () => {};
    
    // Full backtest
    const fullStrategy = useNoMomentum 
      ? new SRNoTrendNoMomentum315Strategy(params as any)
      : new SRNoTrendFilter302Strategy(params);
    const fullEngine = new BacktestEngine(data, fullStrategy, { initialCapital: 1000, feeRate: 0 });
    const fullResult = fullEngine.run();
    
    // Train backtest
    const trainStrategy = useNoMomentum 
      ? new SRNoTrendNoMomentum315Strategy(params as any)
      : new SRNoTrendFilter302Strategy(params);
    const trainEngine = new BacktestEngine(trainData, trainStrategy, { initialCapital: 1000, feeRate: 0 });
    const trainResult = trainEngine.run();
    
    // Test backtest
    const testStrategy = useNoMomentum 
      ? new SRNoTrendNoMomentum315Strategy(params as any)
      : new SRNoTrendFilter302Strategy(params);
    const testEngine = new BacktestEngine(testData, testStrategy, { initialCapital: 1000, feeRate: 0 });
    const testResult = testEngine.run();
    
    console.log = originalLog;
    
    const trainReturn = trainResult.totalReturn;
    const testReturn = testResult.totalReturn;
    const fullReturn = fullResult.totalReturn;
    
    const trainTestRatio = testReturn > 0 ? (trainReturn / testReturn).toFixed(2) : 'N/A';
    const testFullRatio = fullReturn > 0 ? (testReturn / fullReturn).toFixed(2) : 'N/A';
    
    const trainSharpe = trainResult.sharpeRatio?.toFixed(2) || 'N/A';
    const testSharpe = testResult.sharpeRatio?.toFixed(2) || 'N/A';
    
    const overfitRatio = trainReturn / testReturn;
    const lowTrades = testResult.totalTrades < 15;
    const highOverfit = overfitRatio > 2;
    const overfitStatus = (lowTrades || highOverfit) ? '⚠️ YES' : '✓ OK';
    
    console.log(`| ${s.name} | $${trainReturn.toFixed(2)} | $${testReturn.toFixed(2)} | $${fullReturn.toFixed(2)} | ${trainTestRatio} | ${testFullRatio} | ${trainResult.totalTrades} | ${testResult.totalTrades} | ${trainSharpe} | ${testSharpe} | ${overfitStatus} |`);
  }
}

main().catch(console.error);
