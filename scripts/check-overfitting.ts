import * as fs from 'fs';
import * as path from 'path';
import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import { SRNoTrendFilter302Strategy, SRNoTrendFilter302Params } from '../src/strategies/strat_sr_no_trend_filter_302';
import type { StoredData, PricePoint } from '../src/types';

const STRATEGIES = [
  { name: 'sr_ntf_v18_019', file: 'strat_sr_ntf_v18_019.params.json' },
  { name: 'sr_ntf_v20_008', file: 'strat_sr_ntf_v20_008.params.json' },
  { name: 'sr_ntf_v21_022', file: 'strat_sr_ntf_v21_022.params.json' },
  { name: 'sr_ntf_v22_030', file: 'strat_sr_ntf_v22_030.params.json' },
  { name: 'sr_ntf_v24_005', file: 'strat_sr_ntf_v24_005.params.json' },
];

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
  const dataFile = process.argv[2] || 'data/test-data.bson';
  console.log(`Loading data from ${dataFile}...`);
  const data = await loadStoredData(dataFile);
  
  const { train: trainData, test: testData } = splitData(data, 0.7);
  
  const trainPoints = Array.from(trainData.priceHistory.values()).reduce((sum, h) => sum + h.length, 0);
  const testPoints = Array.from(testData.priceHistory.values()).reduce((sum, h) => sum + h.length, 0);
  const totalPoints = Array.from(data.priceHistory.values()).reduce((sum, h) => sum + h.length, 0);
  
  console.log(`Total points: ${totalPoints}, Train: ${trainPoints}, Test: ${testPoints}\n`);
  
  console.log('| Strategy | Train Return | Test Return | Full Return | Train/Test | Test/Full | Train Trades | Test Trades | Train Sharpe | Test Sharpe | Overfit? |');
  console.log('|----------|-------------|-------------|-------------|------------|-----------|--------------|-------------|--------------|-------------|----------|');
  
  for (const { name, file } of STRATEGIES) {
    const paramsPath = path.join(process.cwd(), 'src/strategies', file);
    
    if (!fs.existsSync(paramsPath)) {
      console.log(`| ${name} | FILE NOT FOUND | | | | | | | | | |`);
      continue;
    }
    
    const paramsContent = fs.readFileSync(paramsPath, 'utf-8');
    const params: SRNoTrendFilter302Params = JSON.parse(paramsContent);
    
    const originalLog = console.log;
    console.log = () => {};
    
    // Full backtest
    const fullStrategy = new SRNoTrendFilter302Strategy(params);
    const fullEngine = new BacktestEngine(data, fullStrategy, { initialCapital: 1000, feeRate: 0 });
    const fullResult = fullEngine.run();
    
    // Train backtest
    const trainStrategy = new SRNoTrendFilter302Strategy(params);
    const trainEngine = new BacktestEngine(trainData, trainStrategy, { initialCapital: 1000, feeRate: 0 });
    const trainResult = trainEngine.run();
    
    // Test backtest
    const testStrategy = new SRNoTrendFilter302Strategy(params);
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
    
    console.log(`| ${name} | $${trainReturn.toFixed(2)} | $${testReturn.toFixed(2)} | $${fullReturn.toFixed(2)} | ${trainTestRatio} | ${testFullRatio} | ${trainResult.totalTrades} | ${testResult.totalTrades} | ${trainSharpe} | ${testSharpe} | ${overfitStatus} |`);
  }
}

main().catch(console.error);
