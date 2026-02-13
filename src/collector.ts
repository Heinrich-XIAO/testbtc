import type { Market, PricePoint, StoredData, MarketToken } from './types';
import cliProgress from 'cli-progress';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

export interface CollectorOptions {
  limit?: number;
  active?: boolean;
  minVolume?: number;
  fidelity?: number;
  interval?: string;
  months?: number;
}

export async function fetchMarkets(options: CollectorOptions = {}): Promise<Market[]> {
  const { limit = 100, active = true } = options;
  const allMarkets: any[] = [];
  const batchSize = 500;
  let offset = 0;

  const progressBar = new cliProgress.SingleBar({
    format: 'Fetching markets |{bar}| {percentage}% | {value}/{total} markets',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  progressBar.start(limit, 0);

  while (allMarkets.length < limit) {
    const params = new URLSearchParams();
    params.set('limit', String(Math.min(batchSize, limit - allMarkets.length)));
    params.set('offset', String(offset));
    if (active) {
      params.set('active', 'true');
      params.set('closed', 'false');
    }

    const response = await fetch(`${GAMMA_API}/markets?${params}`);

    if (!response.ok) {
      progressBar.stop();
      throw new Error(`Failed to fetch markets: ${response.statusText}`);
    }

    const data = (await response.json()) as any[];
    
    if (data.length === 0) {
      break; // No more markets available
    }

    allMarkets.push(...data);
    offset += data.length;
    progressBar.update(allMarkets.length);
    
    if (data.length < batchSize) {
      break; // Got fewer than requested, so we're done
    }
  }

  progressBar.stop();
  const data = allMarkets.slice(0, limit);

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
  const markets = await fetchMarkets(options);

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

  console.log(`\nFetching price history for ${allTokenIds.length} tokens...`);

  const cutoffTimestamp = options.months 
    ? Math.floor(Date.now() / 1000) - (options.months * 30 * 24 * 60 * 60)
    : 0;

  const batchSize = 30;
  const totalBatches = Math.ceil(allTokenIds.length / batchSize);

  const progressBar = new cliProgress.SingleBar({
    format: 'Price history |{bar}| {percentage}% | Batch {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  progressBar.start(totalBatches, 0);

  for (let i = 0; i < allTokenIds.length; i += batchSize) {
    const batch = allTokenIds.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    const promises = batch.map(async (tokenId) => {
      const history = await fetchPriceHistory(tokenId, options);
      return { tokenId, history };
    });

    const results = await Promise.all(promises);

    for (const { tokenId, history } of results) {
      if (history.length > 0) {
        const filteredHistory = options.months 
          ? history.filter(point => point.t >= cutoffTimestamp)
          : history;
        if (filteredHistory.length > 0) {
          priceHistory.set(tokenId, filteredHistory);
          totalPricePoints += filteredHistory.length;
        }
      }
    }

    progressBar.update(batchNum);

    if (batchNum < totalBatches) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  progressBar.stop();

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
  const path = await import('path');

  const MAX_BSON_SIZE = 16 * 1024 * 1024; // 16MB limit
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, '.bson');

  // Write metadata separately
  const metadata = {
    collectionMetadata: data.collectionMetadata,
    totalChunks: 0
  };

  // Split markets into chunks
  const marketChunks: Market[][] = [];
  let currentChunk: Market[] = [];
  let currentSize = 0;

  for (const market of data.markets) {
    const marketSize = BSON.calculateObjectSize(market);
    if (currentSize + marketSize > MAX_BSON_SIZE / 2 && currentChunk.length > 0) {
      marketChunks.push(currentChunk);
      currentChunk = [];
      currentSize = 0;
    }
    currentChunk.push(market);
    currentSize += marketSize;
  }
  if (currentChunk.length > 0) {
    marketChunks.push(currentChunk);
  }

  // Split price history into chunks
  const priceChunks: Map<string, PricePoint[]>[] = [];
  let currentPriceChunk = new Map<string, PricePoint[]>();
  currentSize = 0;

  for (const [tokenId, history] of data.priceHistory) {
    const entrySize = BSON.calculateObjectSize({ [tokenId]: history });
    if (currentSize + entrySize > MAX_BSON_SIZE / 2 && currentPriceChunk.size > 0) {
      priceChunks.push(currentPriceChunk);
      currentPriceChunk = new Map();
      currentSize = 0;
    }
    currentPriceChunk.set(tokenId, history);
    currentSize += entrySize;
  }
  if (currentPriceChunk.size > 0) {
    priceChunks.push(currentPriceChunk);
  }

  // Update metadata with chunk counts
  metadata.totalChunks = marketChunks.length + priceChunks.length + 1; // +1 for metadata

  // Write all chunks
  const chunkFiles: string[] = [];

  // Write metadata chunk
  const metadataFile = path.join(dir, `${baseName}.metadata.bson`);
  fs.writeFileSync(metadataFile, Buffer.from(BSON.serialize(metadata)));
  chunkFiles.push(metadataFile);

  // Write market chunks
  for (let i = 0; i < marketChunks.length; i++) {
    const chunkFile = path.join(dir, `${baseName}.markets.${i}.bson`);
    fs.writeFileSync(chunkFile, Buffer.from(BSON.serialize({ markets: marketChunks[i] })));
    chunkFiles.push(chunkFile);
  }

  // Write price history chunks
  for (let i = 0; i < priceChunks.length; i++) {
    const chunkFile = path.join(dir, `${baseName}.prices.${i}.bson`);
    fs.writeFileSync(chunkFile, Buffer.from(BSON.serialize({ priceHistory: Object.fromEntries(priceChunks[i]) })));
    chunkFiles.push(chunkFile);
  }

  // Write manifest file
  const manifest = {
    metadata: `${baseName}.metadata.bson`,
    markets: marketChunks.map((_, i) => `${baseName}.markets.${i}.bson`),
    priceHistory: priceChunks.map((_, i) => `${baseName}.prices.${i}.bson`)
  };
  fs.writeFileSync(filePath, JSON.stringify(manifest));

  // Calculate total size
  let totalSize = 0;
  for (const chunkFile of chunkFiles) {
    const stats = fs.statSync(chunkFile);
    totalSize += stats.size;
  }

  console.log(`Data saved to ${chunkFiles.length} chunks in ${dir}`);
  console.log(`Manifest: ${filePath}`);
  console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total markets: ${data.collectionMetadata.totalMarkets}`);
  console.log(`Total price points: ${data.collectionMetadata.totalPricePoints}`);
}
