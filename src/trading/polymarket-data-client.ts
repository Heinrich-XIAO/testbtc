import type { Market, MarketToken, PricePoint } from '../types';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

export interface MarketData {
  conditionId: string;
  question: string;
  description: string;
  tokens: MarketToken[];
  active: boolean;
  closed: boolean;
  endDate: string;
  volume: number;
}

export interface OrderbookLevel {
  price: string;
  size: string;
}

export interface Orderbook {
  market: string;
  asset_id: string;
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
  timestamp: string;
}

export class PolymarketDataClient {
  async fetchActiveMarkets(limit: number = 50): Promise<MarketData[]> {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('active', 'true');
    params.set('closed', 'false');
    params.set('order', 'volume');
    params.set('ascending', 'false');

    const response = await fetch(`${GAMMA_API}/markets?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.statusText}`);
    }

    const data = (await response.json()) as any[];
    return data.map(this.parseMarketData);
  }

  async fetchMarketByConditionId(conditionId: string): Promise<MarketData | null> {
    const params = new URLSearchParams();
    params.set('condition_id', conditionId);

    const response = await fetch(`${GAMMA_API}/markets?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch market: ${response.statusText}`);
    }

    const data = (await response.json()) as any[];
    if (data.length === 0) return null;
    return this.parseMarketData(data[0]);
  }

  async fetchCurrentPrice(tokenId: string): Promise<number> {
    const response = await fetch(`${CLOB_API}/midpoint?token_id=${tokenId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch price: ${response.statusText}`);
    }

    const data = (await response.json()) as { mid: string };
    return parseFloat(data.mid);
  }

  async fetchOrderbook(tokenId: string): Promise<Orderbook> {
    const response = await fetch(`${CLOB_API}/book?token_id=${tokenId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch orderbook: ${response.statusText}`);
    }

    return (await response.json()) as Orderbook;
  }

  async fetchPriceHistory(
    tokenId: string,
    fidelity: number = 15,
    interval: string = '7d'
  ): Promise<PricePoint[]> {
    const params = new URLSearchParams();
    params.set('market', tokenId);
    params.set('interval', interval);
    params.set('fidelity', String(fidelity));

    const response = await fetch(`${CLOB_API}/prices-history?${params}`);
    if (!response.ok) {
      console.error(`Failed to fetch price history: ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as { history?: PricePoint[] };
    return data.history ?? [];
  }

  async fetchMidpoint(tokenId: string): Promise<number> {
    const response = await fetch(`${CLOB_API}/midpoint?token_id=${tokenId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch midpoint: ${response.statusText}`);
    }

    const data = (await response.json()) as { mid: string };
    return parseFloat(data.mid);
  }

  async fetchTickSize(tokenId: string): Promise<string> {
    const response = await fetch(`${CLOB_API}/tick-size?token_id=${tokenId}`);
    if (!response.ok) {
      return '0.01';
    }

    const data = (await response.json()) as { minimum_tick_size: string };
    return data.minimum_tick_size ?? '0.01';
  }

  async searchMarkets(query: string): Promise<MarketData[]> {
    const params = new URLSearchParams();
    params.set('limit', '20');
    params.set('active', 'true');
    params.set('closed', 'false');
    params.set('text', query);

    const response = await fetch(`${GAMMA_API}/markets?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to search markets: ${response.statusText}`);
    }

    const data = (await response.json()) as any[];
    return data.map(this.parseMarketData);
  }

  async getBestPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<{ price: number; size: number }> {
    const orderbook = await this.fetchOrderbook(tokenId);
    
    if (side === 'BUY') {
      const bestAsk = orderbook.asks[0];
      if (!bestAsk) return { price: 0, size: 0 };
      return {
        price: parseFloat(bestAsk.price),
        size: parseFloat(bestAsk.size),
      };
    } else {
      const bestBid = orderbook.bids[0];
      if (!bestBid) return { price: 0, size: 0 };
      return {
        price: parseFloat(bestBid.price),
        size: parseFloat(bestBid.size),
      };
    }
  }

  private parseMarketData = (m: any): MarketData => {
    let tokens: any[] = [];
    
    if (m.tokens) {
      if (typeof m.tokens === 'string') {
        try {
          tokens = JSON.parse(m.tokens);
        } catch {
          tokens = [];
        }
      } else if (Array.isArray(m.tokens)) {
        tokens = m.tokens;
      }
    } else if (m.clobTokenIds) {
      if (typeof m.clobTokenIds === 'string') {
        try {
          tokens = JSON.parse(m.clobTokenIds).map((id: string) => ({ token_id: id }));
        } catch {
          tokens = [];
        }
      } else if (Array.isArray(m.clobTokenIds)) {
        tokens = m.clobTokenIds.map((id: string) => ({ token_id: id }));
      }
    }

    let outcomes: string[] = [];
    if (typeof m.outcomes === 'string') {
      try {
        outcomes = JSON.parse(m.outcomes);
      } catch {
        outcomes = ['Yes', 'No'];
      }
    } else if (Array.isArray(m.outcomes)) {
      outcomes = m.outcomes;
    }

    let outcomePrices: number[] = [];
    if (typeof m.outcomePrices === 'string') {
      try {
        outcomePrices = JSON.parse(m.outcomePrices).map((p: string) => parseFloat(p));
      } catch {
        outcomePrices = [];
      }
    } else if (Array.isArray(m.outcomePrices)) {
      outcomePrices = m.outcomePrices.map((p: string | number) => 
        typeof p === 'string' ? parseFloat(p) : p
      );
    }

    return {
      conditionId: m.condition_id ?? m.conditionId,
      question: m.question,
      description: m.description ?? '',
      tokens: tokens.map((t: any, i: number): MarketToken => ({
        outcome: outcomes[i] ?? `Outcome ${i}`,
        price: outcomePrices[i] ?? 0,
        token_id: typeof t === 'string' ? t : t.token_id,
        winner: t?.winner ?? false,
      })),
      active: m.active ?? true,
      closed: m.closed ?? false,
      endDate: m.end_date_iso ?? m.endDateIso ?? '',
      volume: parseFloat(m.volume ?? '0'),
    };
  };
}
