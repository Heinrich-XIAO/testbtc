export interface MarketToken {
  outcome: string;
  price: number;
  token_id: string;
  winner: boolean;
}

export interface Market {
  condition_id: string;
  question: string;
  description: string;
  tokens: MarketToken[];
  active: boolean;
  closed: boolean;
  end_date_iso: string;
  minimum_order_size: number;
  tick_size: string;
  neg_risk: boolean;
}

export interface PricePoint {
  t: number;
  p: number;
}

export interface MarketPriceHistory {
  tokenId: string;
  history: PricePoint[];
}

export interface OrderbookLevel {
  price: string;
  size: string;
}

export interface OrderbookSnapshot {
  tokenId: string;
  timestamp: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
}

export interface StoredData {
  markets: Market[];
  priceHistory: Map<string, PricePoint[]>;
  collectionMetadata: {
    collectedAt: string;
    version: string;
    totalMarkets: number;
    totalPricePoints: number;
  };
}

export interface Position {
  tokenId: string;
  size: number;
  avgPrice: number;
  currentValue: number;
  pnl: number;
  buyPrice?: number;
}

export interface OrderResult {
  success: boolean;
  tokenId: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  totalCost: number;
  error?: string;
}

export interface Bar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tokenId: string;
  market: Market;
}

export interface BacktestConfig {
  initialCapital: number;
  feeRate: number;
  slippage: number;
}

export interface BacktestResult {
  finalCapital: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  positions: Position[];
  tradeHistory: TradeRecord[];
}

export interface TradeRecord {
  timestamp: number;
  tokenId: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  totalCost: number;
  positionSizeAfter: number;
  capitalAfter: number;
}

export interface StrategyParams {
  [key: string]: string | number | boolean;
}

export interface Strategy {
  params: StrategyParams;
  onInit(ctx: BacktestContext): void;
  onNext(ctx: BacktestContext, bar: Bar): void;
  onComplete(ctx: BacktestContext): void;
}

export interface BacktestContext {
  portfolio: PortfolioAPI;
  data: DataAPI;
  buy(tokenId: string, size: number): OrderResult;
  sell(tokenId: string, size: number): OrderResult;
  close(tokenId: string): OrderResult;
  getPosition(tokenId: string): Position | undefined;
  getCapital(): number;
  getCurrentPrice(tokenId: string): number;
  getCurrentBar(): Bar;
}

export interface PortfolioAPI {
  getPosition(tokenId: string): Position | undefined;
  getAllPositions(): Position[];
  getTotalValue(): number;
  getPnL(): number;
}

export interface DataAPI {
  getBar(tokenId: string, offset?: number): Bar | undefined;
  getHistory(tokenId: string, length?: number): Bar[];
}

export class Indicator {
  protected values: number[] = [];
  
  get(index: number = 0): number | undefined {
    return this.values[this.values.length - 1 - index];
  }
  
  getValues(): number[] {
    return [...this.values];
  }
  
  protected push(value: number): void {
    this.values.push(value);
  }
}

export class SimpleMovingAverage extends Indicator {
  private period: number;
  private prices: number[] = [];
  
  constructor(period: number) {
    super();
    this.period = period;
  }
  
  update(price: number): void {
    this.prices.push(price);
    if (this.prices.length > this.period) {
      this.prices.shift();
    }
    if (this.prices.length === this.period) {
      const sum = this.prices.reduce((a, b) => a + b, 0);
      this.push(sum / this.period);
    }
  }
}

export class CrossOver extends Indicator {
  private line1: Indicator;
  private line2: Indicator;
  private prevDiff: number | null = null;
  
  constructor(line1: Indicator, line2: Indicator) {
    super();
    this.line1 = line1;
    this.line2 = line2;
  }
  
  update(): void {
    const val1 = this.line1.get(0);
    const val2 = this.line2.get(0);
    
    if (val1 === undefined || val2 === undefined) {
      return;
    }
    
    const diff = val1 - val2;
    
    if (this.prevDiff !== null) {
      if (this.prevDiff <= 0 && diff > 0) {
        this.push(1);
      } else if (this.prevDiff >= 0 && diff < 0) {
        this.push(-1);
      } else {
        this.push(0);
      }
    }
    
    this.prevDiff = diff;
  }
}
