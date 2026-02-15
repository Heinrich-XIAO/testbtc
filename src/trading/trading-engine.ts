import type { Bar, Market, StrategyParams, Strategy } from '../types';
import type { LivePosition, TradingSignal, TradingConfig } from './types';
import { PolySimulatorClient } from './polysimulator-client';
import { PolymarketDataClient, MarketData } from './polymarket-data-client';

interface PriceCache {
  tokenId: string;
  price: number;
  timestamp: number;
}

interface StrategyState {
  prices: Map<string, number[]>;
  highs: Map<string, number[]>;
  lows: Map<string, number[]>;
  kValues: Map<string, number[]>;
  consecutiveBounces: Map<string, number>;
  entryPrice: Map<string, number>;
  highestPrice: Map<string, number>;
  barsHeld: Map<string, number>;
}

export class LiveTradingEngine {
  private polySimClient: PolySimulatorClient;
  private dataClient: PolymarketDataClient;
  private config: TradingConfig;
  private strategy: Strategy;
  private state: StrategyState;
  private markets: Map<string, MarketData> = new Map();
  private tokenToMarket: Map<string, MarketData> = new Map();
  private priceCache: Map<string, PriceCache> = new Map();
  private running: boolean = false;
  private lastUpdate: number = 0;

  constructor(
    strategy: Strategy,
    config: Partial<TradingConfig> = {}
  ) {
    this.strategy = strategy;
    this.config = {
      initialCapital: config.initialCapital ?? 1000,
      maxPositionSize: config.maxPositionSize ?? 100,
      dryRun: config.dryRun ?? true,
      pollIntervalMs: config.pollIntervalMs ?? 60000,
    };
    
    this.polySimClient = new PolySimulatorClient();
    this.dataClient = new PolymarketDataClient();
    this.state = {
      prices: new Map(),
      highs: new Map(),
      lows: new Map(),
      kValues: new Map(),
      consecutiveBounces: new Map(),
      entryPrice: new Map(),
      highestPrice: new Map(),
      barsHeld: new Map(),
    };
  }

  async start(): Promise<void> {
    console.log('Starting live trading engine...');
    console.log(`Mode: ${this.config.dryRun ? 'DRY RUN' : 'LIVE'}`);
    
    await this.polySimClient.init();
    console.log('Browser initialized');
    
    console.log('Please log in to PolySimulator in the browser window...');
    const loggedIn = await this.polySimClient.login();
    if (!loggedIn) {
      throw new Error('Failed to authenticate with PolySimulator');
    }
    console.log('Authenticated successfully');
    
    await this.loadMarkets();
    console.log(`Loaded ${this.markets.size} active markets`);
    
    this.running = true;
    await this.runLoop();
  }

  async stop(): Promise<void> {
    console.log('Stopping trading engine...');
    this.running = false;
    await this.polySimClient.close();
  }

  private async loadMarkets(): Promise<void> {
    const markets = await this.dataClient.fetchActiveMarkets(100);
    
    for (const market of markets) {
      this.markets.set(market.conditionId, market);
      for (const token of market.tokens) {
        this.tokenToMarket.set(token.token_id, market);
        this.state.prices.set(token.token_id, []);
        this.state.highs.set(token.token_id, []);
        this.state.lows.set(token.token_id, []);
        this.state.kValues.set(token.token_id, []);
        this.state.consecutiveBounces.set(token.token_id, 0);
      }
    }
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      try {
        await this.updatePrices();
        await this.evaluateStrategy();
        await this.executeSignals();
        
        const now = Date.now();
        const nextUpdate = this.lastUpdate + this.config.pollIntervalMs;
        const waitTime = Math.max(0, nextUpdate - now);
        
        console.log(`Next update in ${Math.round(waitTime / 1000)}s`);
        await this.sleep(waitTime);
        
      } catch (error) {
        console.error('Error in trading loop:', error);
        await this.sleep(10000);
      }
    }
  }

  private async updatePrices(): Promise<void> {
    console.log('Updating prices...');
    this.lastUpdate = Date.now();
    
    const tokenIds = Array.from(this.tokenToMarket.keys());
    let updated = 0;
    
    for (const tokenId of tokenIds) {
      try {
        const price = await this.dataClient.fetchCurrentPrice(tokenId);
        
        this.priceCache.set(tokenId, {
          tokenId,
          price,
          timestamp: this.lastUpdate,
        });
        
        const prices = this.state.prices.get(tokenId) ?? [];
        prices.push(price);
        if (prices.length > 100) prices.shift();
        this.state.prices.set(tokenId, prices);
        
        this.state.highs.get(tokenId)?.push(price);
        this.state.lows.get(tokenId)?.push(price);
        
        const highs = this.state.highs.get(tokenId) ?? [];
        const lows = this.state.lows.get(tokenId) ?? [];
        if (highs.length > 50) highs.shift();
        if (lows.length > 50) lows.shift();
        
        updated++;
      } catch (error) {
        // Skip failed price fetch
      }
    }
    
    console.log(`Updated ${updated}/${tokenIds.length} prices`);
  }

  private async evaluateStrategy(): Promise<void> {
    console.log('Evaluating strategy...');
    
    for (const [tokenId, prices] of this.state.prices) {
      if (prices.length < 20) continue;
      
      const currentPrice = prices[prices.length - 1];
      const prevPrice = prices.length > 1 ? prices[prices.length - 2] : currentPrice;
      
      let consecutiveBounces = this.state.consecutiveBounces.get(tokenId) ?? 0;
      if (currentPrice > prevPrice) {
        consecutiveBounces++;
      } else {
        consecutiveBounces = 0;
      }
      this.state.consecutiveBounces.set(tokenId, consecutiveBounces);
      
      const signal = this.generateSignal(tokenId, currentPrice, prices, consecutiveBounces);
      
      if (signal) {
        await this.executeSignal(signal);
      }
    }
  }

  private generateSignal(
    tokenId: string,
    currentPrice: number,
    prices: number[],
    consecutiveBounces: number
  ): TradingSignal | null {
    const params = (this.strategy.params as any) ?? {};
    
    const stochK = params.stoch_k_period ?? 18;
    const stochOversold = params.stoch_oversold ?? 18;
    const stochOverbought = params.stoch_overbought ?? 80;
    const momentumPeriod = params.momentum_period ?? 3;
    const momentumThreshold = params.momentum_threshold ?? 0.006;
    const minBounceBars = params.min_bounce_bars ?? 1;
    const stopLoss = params.stop_loss ?? 0.065;
    const trailingStop = params.trailing_stop ?? 0.07;
    const profitTarget = params.profit_target ?? 0.14;
    const maxHoldBars = params.max_hold_bars ?? 32;
    const riskPercent = params.risk_percent ?? 0.32;
    const lookback = params.base_lookback ?? 20;
    const bounceThreshold = params.bounce_threshold ?? 0.022;
    
    const kValues = this.state.kValues.get(tokenId) ?? [];
    if (prices.length < stochK) return null;
    
    const slice = prices.slice(-stochK);
    const high = Math.max(...slice);
    const low = Math.min(...slice);
    const k = high === low ? 50 : ((currentPrice - low) / (high - low)) * 100;
    kValues.push(k);
    if (kValues.length > 5) kValues.shift();
    this.state.kValues.set(tokenId, kValues);
    
    const d = kValues.length >= 3 ? kValues.slice(-3).reduce((a, b) => a + b, 0) / 3 : k;
    
    const momentum = prices.length > momentumPeriod
      ? (currentPrice - prices[prices.length - 1 - momentumPeriod]) / prices[prices.length - 1 - momentumPeriod]
      : 0;
    
    const recentLows = prices.slice(-lookback).sort((a, b) => a - b);
    const supports = recentLows.slice(0, 3);
    const nearSupport = supports.some(s => Math.abs(currentPrice - s) / s < bounceThreshold);
    
    const stochOversoldCond = k <= stochOversold && k > d;
    const momentumOk = momentum >= momentumThreshold;
    const multiBarBounce = consecutiveBounces >= minBounceBars;
    
    const entryPrice = this.state.entryPrice.get(tokenId);
    
    if (entryPrice) {
      const highest = this.state.highestPrice.get(tokenId) ?? currentPrice;
      const bars = this.state.barsHeld.get(tokenId) ?? 0;
      this.state.barsHeld.set(tokenId, bars + 1);
      
      if (currentPrice > highest) {
        this.state.highestPrice.set(tokenId, currentPrice);
      }
      
      if (currentPrice < entryPrice * (1 - stopLoss)) {
        return { tokenId, action: 'CLOSE', reason: 'Stop loss hit', confidence: 1 };
      }
      if (currentPrice < highest * (1 - trailingStop)) {
        return { tokenId, action: 'CLOSE', reason: 'Trailing stop hit', confidence: 1 };
      }
      if (currentPrice >= entryPrice * (1 + profitTarget)) {
        return { tokenId, action: 'CLOSE', reason: 'Profit target reached', confidence: 1 };
      }
      if (bars >= maxHoldBars) {
        return { tokenId, action: 'CLOSE', reason: 'Max hold time reached', confidence: 1 };
      }
      if (k >= stochOverbought) {
        return { tokenId, action: 'CLOSE', reason: 'Stochastic overbought', confidence: 0.8 };
      }
      
      return null;
    }
    
    if (currentPrice > 0.05 && currentPrice < 0.95) {
      if (nearSupport && multiBarBounce && stochOversoldCond && momentumOk) {
        const size = (this.config.initialCapital * riskPercent * 0.995) / currentPrice;
        return {
          tokenId,
          action: 'BUY',
          size: Math.min(size, this.config.maxPositionSize),
          reason: `Entry: near support, stoch=${k.toFixed(1)}, mom=${(momentum * 100).toFixed(2)}%`,
          confidence: 0.7,
        };
      }
    }
    
    return null;
  }

  private signals: TradingSignal[] = [];

  private async executeSignal(signal: TradingSignal): Promise<void> {
    this.signals.push(signal);
  }

  private async executeSignals(): Promise<void> {
    if (this.signals.length === 0) return;
    
    for (const signal of this.signals) {
      console.log(`\nSignal: ${signal.action} ${signal.tokenId}`);
      console.log(`Reason: ${signal.reason}`);
      console.log(`Confidence: ${(signal.confidence * 100).toFixed(0)}%`);
      
      if (this.config.dryRun) {
        console.log('[DRY RUN] Would execute order');
        continue;
      }
      
      const market = this.tokenToMarket.get(signal.tokenId);
      if (!market) {
        console.log('Market not found for token');
        continue;
      }
      
      if (signal.action === 'BUY' && signal.size) {
        const order = await this.polySimClient.placeBuyOrder(signal.tokenId, signal.size);
        if (order.status === 'filled') {
          this.state.entryPrice.set(signal.tokenId, this.priceCache.get(signal.tokenId)?.price ?? 0);
          this.state.highestPrice.set(signal.tokenId, this.priceCache.get(signal.tokenId)?.price ?? 0);
          this.state.barsHeld.set(signal.tokenId, 0);
          console.log('Buy order filled!');
        }
      } else if (signal.action === 'CLOSE' || signal.action === 'SELL') {
        const order = await this.polySimClient.placeSellOrder(signal.tokenId, 0);
        if (order.status === 'filled') {
          this.state.entryPrice.delete(signal.tokenId);
          this.state.highestPrice.delete(signal.tokenId);
          this.state.barsHeld.delete(signal.tokenId);
          console.log('Position closed!');
        }
      }
    }
    
    this.signals = [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus(): { running: boolean; markets: number; lastUpdate: number } {
    return {
      running: this.running,
      markets: this.markets.size,
      lastUpdate: this.lastUpdate,
    };
  }
}
