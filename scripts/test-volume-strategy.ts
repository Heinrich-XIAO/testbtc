import * as fs from 'fs';
import * as path from 'path';
import { BacktestEngine, loadStoredData } from '../src/backtest/engine';
import { SRNoTrendFilter302Strategy } from '../src/strategies/strat_sr_no_trend_filter_302';
import { SRNoTrendVolume313Strategy } from '../src/strategies/strat_sr_no_trend_volume_313';
import type { StoredData, PricePoint } from '../src/types';

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
  console.log(`Loading data from ${dataFile}...\n`);
  const data = await loadStoredData(dataFile);
  
  const { train: trainData, test: testData } = splitData(data, 0.7);
  
  const trainPoints = Array.from(trainData.priceHistory.values()).reduce((sum, h) => sum + h.length, 0);
  const testPoints = Array.from(testData.priceHistory.values()).reduce((sum, h) => sum + h.length, 0);
  
  console.log(`Train points: ${trainPoints}, Test points: ${testPoints}\n`);
  
  console.log('| Strategy | Train Return | Test Return | Full Return | Train Trades | Test Trades | Train Sharpe | Test Sharpe | Overfit? |');
  console.log('|----------|-------------|-------------|-------------|--------------|-------------|--------------|-------------|----------|');
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const strategies: Array<{ name: string; Strategy: any; params: any }> = [
    { name: 'base_302', Strategy: SRNoTrendFilter302Strategy, params: {} },
    { name: 'vol_off', Strategy: SRNoTrendVolume313Strategy, params: { volume_mode: 'off' } },
    { name: 'vol_low_0.8', Strategy: SRNoTrendVolume313Strategy, params: { volume_threshold: 0.8, volume_mode: 'low' } },
    { name: 'vol_low_0.6', Strategy: SRNoTrendVolume313Strategy, params: { volume_threshold: 0.6, volume_mode: 'low' } },
    { name: 'vol_high_1.0', Strategy: SRNoTrendVolume313Strategy, params: { volume_threshold: 1.0, volume_mode: 'high' } },
    { name: 'vol_surge', Strategy: SRNoTrendVolume313Strategy, params: { volume_mode: 'surge' } },
  ];
  
  for (const { name, Strategy, params } of strategies) {
    const originalLog = console.log;
    console.log = () => {};
    
    const fullStrategy = new Strategy(params);
    const fullEngine = new BacktestEngine(data, fullStrategy, { initialCapital: 1000, feeRate: 0 });
    const fullResult = fullEngine.run();
    
    const trainStrategy = new Strategy(params);
    const trainEngine = new BacktestEngine(trainData, trainStrategy, { initialCapital: 1000, feeRate: 0 });
    const trainResult = trainEngine.run();
    
    const testStrategy = new Strategy(params);
    const testEngine = new BacktestEngine(testData, testStrategy, { initialCapital: 1000, feeRate: 0 });
    const testResult = testEngine.run();
    
    console.log = originalLog;
    
    const trainReturn = trainResult.totalReturn;
    const testReturn = testResult.totalReturn;
    const fullReturn = fullResult.totalReturn;
    
    const trainSharpe = trainResult.sharpeRatio?.toFixed(2) || 'N/A';
    const testSharpe = testResult.sharpeRatio?.toFixed(2) || 'N/A';
    
    const overfitRatio = testReturn > 0 ? trainReturn / testReturn : 999;
    const lowTrades = testResult.totalTrades < 15;
    const highOverfit = overfitRatio > 2;
    const overfitStatus = (lowTrades || highOverfit) ? 'YES' : 'OK';
    
    console.log(`| ${name} | $${trainReturn.toFixed(2)} | $${testReturn.toFixed(2)} | $${fullReturn.toFixed(2)} | ${trainResult.totalTrades} | ${testResult.totalTrades} | ${trainSharpe} | ${testSharpe} | ${overfitStatus} |`);
  }
}

main().catch(console.error);
