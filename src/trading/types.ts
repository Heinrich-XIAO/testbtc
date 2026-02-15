export interface LivePosition {
  tokenId: string;
  marketQuestion: string;
  outcome: string;
  size: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
}

export interface LiveOrder {
  id: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  timestamp: number;
}

export interface TradingAccount {
  balance: number;
  availableBalance: number;
  totalPnL: number;
  positions: LivePosition[];
  openOrders: LiveOrder[];
}

export interface MarketSnapshot {
  conditionId: string;
  question: string;
  tokens: {
    tokenId: string;
    outcome: string;
    price: number;
    volume: number;
  }[];
  active: boolean;
  endDate: string;
}

export interface TradingSignal {
  tokenId: string;
  action: 'BUY' | 'SELL' | 'CLOSE';
  size?: number;
  reason: string;
  confidence: number;
}

export interface TradingConfig {
  initialCapital: number;
  maxPositionSize: number;
  dryRun: boolean;
  pollIntervalMs: number;
}

export interface PolySimulatorSession {
  isAuthenticated: boolean;
  balance: number;
  lastUpdate: number;
}
