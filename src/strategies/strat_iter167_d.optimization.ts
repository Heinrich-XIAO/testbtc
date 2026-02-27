import { RangeTradingStrategy, type RangeTradingParams } from './strat_iter167_d';
import * as fs from 'fs';
import * as path from 'path';

interface OptimizationResult {
  params: RangeTradingParams;
  score: number;
}

const paramRanges = {
  range_lookback: [10, 20, 30],
  entry_threshold: [0.1, 0.2, 0.3],
  stoch_oversold: [16, 20, 24],
  stop_loss: [0.05, 0.10],
  profit_target: [0.50, 0.75, 1.0],
};

function generateCombinations(): RangeTradingParams[] {
  const combinations: RangeTradingParams[] = [];
  
  for (const range_lookback of paramRanges.range_lookback) {
    for (const entry_threshold of paramRanges.entry_threshold) {
      for (const stoch_oversold of paramRanges.stoch_oversold) {
        for (const stop_loss of paramRanges.stop_loss) {
          for (const profit_target of paramRanges.profit_target) {
            combinations.push({
              range_lookback,
              entry_threshold,
              stoch_oversold,
              stoch_overbought: 100 - stoch_oversold,
              stoch_k_period: 14,
              stop_loss,
              profit_target,
              risk_percent: 0.25,
              max_hold_bars: 28,
            });
          }
        }
      }
    }
  }
  
  return combinations;
}

function evaluateStrategy(params: RangeTradingParams, data: any[]): number {
  const strategy = new RangeTradingStrategy(params);
  
  let totalReturn = 0;
  let winCount = 0;
  let lossCount = 0;
  let totalTrades = 0;
  
  for (const marketData of data) {
    if (!marketData.history || marketData.history.length < params.range_lookback + 20) continue;
    
    const bars = marketData.history.map((p: any) => ({
      timestamp: p.t,
      open: p.p,
      high: p.p,
      low: p.p,
      close: p.p,
      tokenId: marketData.tokenId,
      market: marketData.market,
    }));
    
    let position: { entryPrice: number; size: number } | null = null;
    let capital = 1000;
    let barCount = 0;
    let entryBar = 0;
    let rangeMid = 0;
    
    const priceHistory: number[] = [];
    const highHistory: number[] = [];
    const lowHistory: number[] = [];
    const kValues: number[] = [];
    
    for (const bar of bars) {
      barCount++;
      priceHistory.push(bar.close);
      highHistory.push(bar.high);
      lowHistory.push(bar.low);
      
      if (priceHistory.length > 200) priceHistory.shift();
      if (highHistory.length > 200) highHistory.shift();
      if (lowHistory.length > 200) lowHistory.shift();
      
      if (priceHistory.length >= params.stoch_k_period) {
        const slice = priceHistory.slice(-params.stoch_k_period);
        const highest = Math.max(...slice);
        const lowest = Math.min(...slice);
        const k = highest === lowest ? 50 : ((bar.close - lowest) / (highest - lowest)) * 100;
        kValues.push(k);
        if (kValues.length > 100) kValues.shift();
      }
      
      if (position) {
        if (bar.close <= position.entryPrice * (1 - params.stop_loss)) {
          const pnl = (bar.close - position.entryPrice) * position.size;
          capital += pnl;
          totalTrades++;
          if (pnl > 0) winCount++;
          else lossCount++;
          position = null;
        } else if (bar.close >= rangeMid) {
          const pnl = (bar.close - position.entryPrice) * position.size;
          capital += pnl;
          totalTrades++;
          if (pnl > 0) winCount++;
          else lossCount++;
          position = null;
        } else if (barCount - entryBar >= params.max_hold_bars) {
          const pnl = (bar.close - position.entryPrice) * position.size;
          capital += pnl;
          totalTrades++;
          if (pnl > 0) winCount++;
          else lossCount++;
          position = null;
        }
      } else if (priceHistory.length >= params.range_lookback && kValues.length >= 2) {
        const highSlice = highHistory.slice(-params.range_lookback);
        const lowSlice = lowHistory.slice(-params.range_lookback);
        const rangeHigh = Math.max(...highSlice);
        const rangeLow = Math.min(...lowSlice);
        const rangeSize = rangeHigh - rangeLow;
        const rangePosition = (bar.close - rangeLow) / rangeSize;
        
        const prevK = kValues[kValues.length - 2];
        const currK = kValues[kValues.length - 1];
        
        if (prevK < params.stoch_oversold && currK >= params.stoch_oversold && rangePosition <= params.entry_threshold) {
          const size = (capital * params.risk_percent) / bar.close;
          position = { entryPrice: bar.close, size };
          entryBar = barCount;
          rangeMid = (rangeHigh + rangeLow) / 2;
        }
      }
    }
    
    if (position && bars.length > 0) {
      const lastBar = bars[bars.length - 1];
      const pnl = (lastBar.close - position.entryPrice) * position.size;
      capital += pnl;
      totalTrades++;
      if (pnl > 0) winCount++;
      else lossCount++;
    }
    
    const marketReturn = (capital - 1000) / 1000;
    totalReturn += marketReturn;
  }
  
  if (totalTrades < 5) return -999;
  
  const avgReturn = totalReturn / data.length;
  const winRate = totalTrades > 0 ? winCount / totalTrades : 0;
  
  return avgReturn * 100 + winRate * 10 - (lossCount / Math.max(totalTrades, 1)) * 5;
}

async function optimize() {
  const dataPath = process.argv[2] || './data/test-data.json';
  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(rawData);
  
  const combinations = generateCombinations();
  console.log(`Testing ${combinations.length} parameter combinations...`);
  
  let bestResult: OptimizationResult | null = null;
  
  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];
    const score = evaluateStrategy(params, data);
    
    if (i % 50 === 0) {
      console.log(`Progress: ${i}/${combinations.length}, best score: ${bestResult?.score.toFixed(4) || 'N/A'}`);
    }
    
    if (bestResult === null || score > bestResult.score) {
      bestResult = { params, score };
      console.log(`New best score: ${score.toFixed(4)} with params:`, params);
    }
  }
  
  if (bestResult) {
    console.log('\n=== Best Parameters ===');
    console.log(`Score: ${bestResult.score.toFixed(4)}`);
    console.log('Parameters:', bestResult.params);
    
    const paramsPath = path.join(__dirname, 'strat_iter167_d.params.json');
    fs.writeFileSync(paramsPath, JSON.stringify(bestResult.params, null, 2));
    console.log(`\nSaved to ${paramsPath}`);
  }
}

optimize().catch(console.error);
