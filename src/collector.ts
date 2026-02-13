import type { Market, PricePoint, StoredData, MarketToken } from './types';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

export interface CollectorOptions {
  limit?: number;
  active?: boolean;
  minVolume?: number;
  fidelity?: number;
  interval?: string;
}

export async function fetchMarkets(options: CollectorOptions = {}): Promise<Market[]> {
  const { limit = 100, active = true } = options;

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (active) {
    params.set('active', 'true');
    params.set('closed', 'false');
  }

  const response = await fetch(`${GAMMA_API}/markets?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.statusText}`);
  }

  const data = (await response.json()) as any[];

  return data.map((m: any): Market => {
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
      outcomePrices = m.outcomePrices.map((p: string | number) => typeof p === 'string' ? parseFloat(p) : p);
    }

    return {
      condition_id: m.condition_id ?? m.conditionId,
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
      end_date_iso: m.end_date_iso ?? m.endDateIso ?? '',
      minimum_order_size: parseFloat(m.minimum_order_size ?? m.minimumOrderSize ?? '1'),
      tick_size: m.tick_size ?? m.minimum_tick_size ?? '0.01',
      neg_risk: m.neg_risk ?? m.negRisk ?? false,
    };
  });
}

export async function fetchPriceHistory(
  tokenId: string,
  options: CollectorOptions = {}
): Promise<PricePoint[]> {
  const { fidelity = 60, interval = 'max' } = options;

  const params = new URLSearchParams();
  params.set('market', tokenId);
  params.set('interval', interval);
  params.set('fidelity', String(fidelity));

  const response = await fetch(`${CLOB_API}/prices-history?${params}`);

  if (!response.ok) {
    console.error(`Failed to fetch price history for ${tokenId}: ${response.statusText}`);
    return [];
  }

  const data = (await response.json()) as { history?: PricePoint[] };
  return data.history ?? [];
}

export async function collectData(options: CollectorOptions = {}): Promise<StoredData> {
  console.log('Fetching markets from Gamma API...');
  const markets = await fetchMarkets(options);
  console.log(`Found ${markets.length} markets`);

  const priceHistory = new Map<string, PricePoint[]>();
  let totalPricePoints = 0;

  const allTokenIds: string[] = [];
  for (const market of markets) {
    for (const token of market.tokens) {
      if (token.token_id) {
        allTokenIds.push(token.token_id);
      }
    }
  }

  console.log(`Fetching price history for ${allTokenIds.length} tokens...`);

  const batchSize = 5;
  for (let i = 0; i < allTokenIds.length; i += batchSize) {
    const batch = allTokenIds.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(allTokenIds.length / batchSize);

    console.log(`Processing batch ${batchNum}/${totalBatches}...`);

    const promises = batch.map(async (tokenId) => {
      const history = await fetchPriceHistory(tokenId, options);
      return { tokenId, history };
    });

    const results = await Promise.all(promises);

    for (const { tokenId, history } of results) {
      if (history.length > 0) {
        priceHistory.set(tokenId, history);
        totalPricePoints += history.length;
      }
    }

    if (batchNum < totalBatches) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const storedData: StoredData = {
    markets,
    priceHistory,
    collectionMetadata: {
      collectedAt: new Date().toISOString(),
      version: '1.0.0',
      totalMarkets: markets.length,
      totalPricePoints,
    },
  };

  return storedData;
}

export async function saveToBson(data: StoredData, filePath: string): Promise<void> {
  const BSON = await import('bson');
  const fs = await import('fs');

  const serialized = BSON.serialize(data);
  fs.writeFileSync(filePath, Buffer.from(serialized));

  const stats = fs.statSync(filePath);
  console.log(`Data saved to ${filePath}`);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total markets: ${data.collectionMetadata.totalMarkets}`);
  console.log(`Total price points: ${data.collectionMetadata.totalPricePoints}`);
}
