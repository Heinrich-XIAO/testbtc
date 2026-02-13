import type {
  Bar,
  Market,
  PricePoint,
  Position,
  OrderResult,
  BacktestConfig,
  BacktestResult,
  BacktestContext,
  PortfolioAPI,
  DataAPI,
  Strategy,
  StoredData,
  TradeRecord,
} from '../types';
import { Portfolio } from './portfolio';

export class BacktestEngine {
  private config: BacktestConfig;
  private data: StoredData;
  private portfolio: Portfolio;
  private strategy: Strategy;
  private bars: Map<string, Bar[]> = new Map();
  private currentBarIndex: number = 0;
  private maxBars: number = 0;
  private currentBar: Bar | null = null;
  private barHistory: Map<string, Bar[]> = new Map();

  constructor(data: StoredData, strategy: Strategy, config?: Partial<BacktestConfig>) {
    this.data = data;
    this.strategy = strategy;
    this.config = {
      initialCapital: config?.initialCapital ?? 1000,
      feeRate: config?.feeRate ?? 0,
      slippage: config?.slippage ?? 0,
    };
    this.portfolio = new Portfolio(this.config.initialCapital, this.config.feeRate);
    this.prepareBars();
  }

  private prepareBars(): void {
    const allTimestamps = new Set<number>();

    for (const [tokenId, history] of this.data.priceHistory) {
      for (const point of history) {
        allTimestamps.add(point.t);
      }
    }

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    for (const [tokenId, history] of this.data.priceHistory) {
      const priceMap = new Map<number, number>();
      for (const point of history) {
        priceMap.set(point.t, point.p);
      }

      const market = this.findMarketForToken(tokenId);
      if (!market) continue;

      const tokenBars: Bar[] = [];

      for (const ts of sortedTimestamps) {
        const price = priceMap.get(ts);
        if (price !== undefined) {
          tokenBars.push({
            timestamp: ts,
            open: price,
            high: price,
            low: price,
            close: price,
            tokenId,
            market,
          });
        }
      }

      this.bars.set(tokenId, tokenBars);
      this.barHistory.set(tokenId, []);

      if (tokenBars.length > this.maxBars) {
        this.maxBars = tokenBars.length;
      }
    }
  }

  private findMarketForToken(tokenId: string): Market | undefined {
    return this.data.markets.find((m) => m.tokens.some((t) => t.token_id === tokenId));
  }

  run(): BacktestResult {
    const ctx = this.createContext();
    this.strategy.onInit(ctx);

    const tokenIds = Array.from(this.bars.keys());

    for (let i = 0; i < this.maxBars; i++) {
      this.currentBarIndex = i;

      const currentPrices = new Map<string, number>();

      for (const tokenId of tokenIds) {
        const tokenBars = this.bars.get(tokenId);
        if (tokenBars && tokenBars[i]) {
          const bar = tokenBars[i];
          this.currentBar = bar;
          currentPrices.set(tokenId, bar.close);

          const history = this.barHistory.get(tokenId) ?? [];
          history.push(bar);
          this.barHistory.set(tokenId, history);

          this.strategy.onNext(ctx, bar);
        }
      }

      this.portfolio.updatePositionValues(currentPrices);
    }

    return this.calculateResult();
  }

  private createContext(): BacktestContext {
    const self = this;

    const portfolioAPI: PortfolioAPI = {
      getPosition(tokenId: string): Position | undefined {
        return self.portfolio.getPosition(tokenId);
      },
      getAllPositions(): Position[] {
        return self.portfolio.getAllPositions();
      },
      getTotalValue(): number {
        const prices = new Map<string, number>();
        for (const [tokenId, bars] of self.bars) {
          if (bars[self.currentBarIndex]) {
            prices.set(tokenId, bars[self.currentBarIndex].close);
          }
        }
        return self.portfolio.getTotalValue(prices);
      },
      getPnL(): number {
        const prices = new Map<string, number>();
        for (const [tokenId, bars] of self.bars) {
          if (bars[self.currentBarIndex]) {
            prices.set(tokenId, bars[self.currentBarIndex].close);
          }
        }
        return self.portfolio.getPnL(prices);
      },
    };

    const dataAPI: DataAPI = {
      getBar(tokenId: string, offset: number = 0): Bar | undefined {
        const history = self.barHistory.get(tokenId);
        if (!history) return undefined;
        const idx = history.length - 1 - offset;
        return idx >= 0 ? history[idx] : undefined;
      },
      getHistory(tokenId: string, length?: number): Bar[] {
        const history = self.barHistory.get(tokenId) ?? [];
        if (length === undefined) return [...history];
        return history.slice(-length);
      },
    };

    return {
      portfolio: portfolioAPI,
      data: dataAPI,

      buy(tokenId: string, size: number): OrderResult {
        const bar = self.currentBar;
        if (!bar) {
          return {
            success: false,
            tokenId,
            side: 'BUY',
            size: 0,
            price: 0,
            totalCost: 0,
            error: 'No current bar',
          };
        }
        const price = bar.close;
        return self.portfolio.buy(tokenId, size, price, bar.timestamp);
      },

      sell(tokenId: string, size: number): OrderResult {
        const bar = self.currentBar;
        if (!bar) {
          return {
            success: false,
            tokenId,
            side: 'SELL',
            size: 0,
            price: 0,
            totalCost: 0,
            error: 'No current bar',
          };
        }
        const price = bar.close;
        return self.portfolio.sell(tokenId, size, price, bar.timestamp);
      },

      close(tokenId: string): OrderResult {
        const bar = self.currentBar;
        if (!bar) {
          return {
            success: false,
            tokenId,
            side: 'SELL',
            size: 0,
            price: 0,
            totalCost: 0,
            error: 'No current bar',
          };
        }
        const price = bar.close;
        return self.portfolio.close(tokenId, price, bar.timestamp);
      },

      getPosition(tokenId: string): Position | undefined {
        return self.portfolio.getPosition(tokenId);
      },

      getCapital(): number {
        return self.portfolio.getCapital();
      },

      getCurrentPrice(tokenId: string): number {
        const bar = self.currentBar;
        if (!bar || bar.tokenId !== tokenId) {
          const bars = self.bars.get(tokenId);
          if (bars && bars[self.currentBarIndex]) {
            return bars[self.currentBarIndex].close;
          }
          return 0;
        }
        return bar.close;
      },

      getCurrentBar(): Bar {
        return self.currentBar!;
      },
    };
  }

  private calculateResult(): BacktestResult {
    const tradeHistory = this.portfolio.getTradeHistory();
    const finalPrices = new Map<string, number>();

    for (const [tokenId, bars] of this.bars) {
      if (bars.length > 0) {
        finalPrices.set(tokenId, bars[bars.length - 1].close);
      }
    }

    const finalCapital = this.portfolio.getTotalValue(finalPrices);
    const totalReturn = finalCapital - this.config.initialCapital;
    const totalReturnPercent = (totalReturn / this.config.initialCapital) * 100;

    const values: number[] = [];
    let runningValue = this.config.initialCapital;
    let maxValue = runningValue;
    let maxDrawdown = 0;

    for (const trade of tradeHistory) {
      const pos = this.portfolio.getPosition(trade.tokenId);
      const price = finalPrices.get(trade.tokenId) ?? trade.price;

      if (trade.side === 'SELL') {
        runningValue = trade.capitalAfter;
      } else {
        runningValue = trade.capitalAfter;
      }

      if (pos) {
        runningValue += pos.size * price;
      }

      values.push(runningValue);

      if (runningValue > maxValue) {
        maxValue = runningValue;
      }
      const drawdown = (maxValue - runningValue) / maxValue;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    let sharpeRatio = 0;
    if (values.length > 1) {
      const returns: number[] = [];
      for (let i = 1; i < values.length; i++) {
        returns.push((values[i] - values[i - 1]) / values[i - 1]);
      }
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const stdDev = Math.sqrt(
        returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      );
      sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    }

    let winningTrades = 0;
    let losingTrades = 0;
    let totalBuyCost = new Map<string, number>();
    let totalBuySize = new Map<string, number>();

    for (const trade of tradeHistory) {
      if (trade.side === 'BUY') {
        const prevCost = totalBuyCost.get(trade.tokenId) ?? 0;
        const prevSize = totalBuySize.get(trade.tokenId) ?? 0;
        totalBuyCost.set(trade.tokenId, prevCost + trade.totalCost);
        totalBuySize.set(trade.tokenId, prevSize + trade.size);
      } else {
        const avgBuyPrice = (totalBuyCost.get(trade.tokenId) ?? 0) / (totalBuySize.get(trade.tokenId) ?? 1);
        const sellPrice = trade.price;
        if (sellPrice >= avgBuyPrice) {
          winningTrades++;
        } else {
          losingTrades++;
        }
        totalBuyCost.delete(trade.tokenId);
        totalBuySize.delete(trade.tokenId);
      }
    }

    return {
      finalCapital,
      totalReturn,
      totalReturnPercent,
      maxDrawdown: maxDrawdown * 100,
      sharpeRatio,
      totalTrades: tradeHistory.length,
      winningTrades,
      losingTrades,
      positions: this.portfolio.getAllPositions(),
      tradeHistory,
    };
  }
}

export function loadStoredData(filePath: string): StoredData {
  const fs = require('fs');
  const path = require('path');
  const BSON = require('bson');

  // Check if it's a manifest file (new chunked format)
  const content = fs.readFileSync(filePath, 'utf8');
  let manifest: { metadata: string; markets: string[]; priceHistory: string[] } | null = null;
  
  try {
    manifest = JSON.parse(content);
  } catch {
    // Not JSON, assume old BSON format
  }

  if (manifest && manifest.metadata) {
    // New chunked format - load from manifest
    const dir = path.dirname(filePath);
    
    // Load metadata
    const metadataBuffer = fs.readFileSync(path.join(dir, manifest.metadata));
    const metadata = BSON.deserialize(metadataBuffer);
    
    // Load markets from chunks
    const markets: Market[] = [];
    for (const chunkFile of manifest.markets) {
      const chunkBuffer = fs.readFileSync(path.join(dir, chunkFile));
      const chunk = BSON.deserialize(chunkBuffer);
      if (chunk.markets) {
        markets.push(...chunk.markets);
      }
    }
    
    // Load price history from chunks
    const priceHistory = new Map<string, PricePoint[]>();
    for (const chunkFile of manifest.priceHistory) {
      const chunkBuffer = fs.readFileSync(path.join(dir, chunkFile));
      const chunk = BSON.deserialize(chunkBuffer);
      if (chunk.priceHistory) {
        for (const [key, value] of Object.entries(chunk.priceHistory)) {
          priceHistory.set(key, value as PricePoint[]);
        }
      }
    }
    
    return {
      markets,
      priceHistory,
      collectionMetadata: metadata.collectionMetadata ?? {
        collectedAt: '',
        version: '1.0.0',
        totalMarkets: markets.length,
        totalPricePoints: Array.from(priceHistory.values()).reduce((sum, h) => sum + h.length, 0),
      },
    };
  }

  // Old format - single BSON file
  const buffer = fs.readFileSync(filePath);
  const raw = BSON.deserialize(buffer);

  const priceHistory = new Map<string, PricePoint[]>();
  if (raw.priceHistory) {
    if (raw.priceHistory instanceof Map) {
      for (const [key, value] of raw.priceHistory) {
        priceHistory.set(key, value);
      }
    } else {
      for (const key of Object.keys(raw.priceHistory)) {
        priceHistory.set(key, raw.priceHistory[key]);
      }
    }
  }

  return {
    markets: raw.markets ?? [],
    priceHistory,
    collectionMetadata: raw.collectionMetadata ?? {
      collectedAt: '',
      version: '1.0.0',
      totalMarkets: 0,
      totalPricePoints: 0,
    },
  };
}
