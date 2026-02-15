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
  minPoints?: number;
}

export async function fetchMarkets(options: CollectorOptions = {}): Promise<Market[]> {
  const { limit = 100, active = false } = options;
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
    params.set('order', 'createdAt');
    params.set('ascending', 'false');
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
  const { fidelity = 15, interval = 'max' } = options;

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
  const { limit = 100, active = false, minPoints = 0, fidelity = 15, minVolume = 0 } = options;
  const qualifiedMarkets: Market[] = [];
  const priceHistory = new Map<string, PricePoint[]>();
  let totalPricePoints = 0;
  
  const cutoffTimestamp = options.months 
    ? Math.floor(Date.now() / 1000) - (options.months * 30 * 24 * 60 * 60)
    : 0;

  // Two-pass mode: if minPoints >= 200 and fidelity < 60, pre-screen at fidelity=60
  // to quickly skip short-lived markets, then re-fetch qualifying ones at target fidelity
  const usePreScreen = minPoints >= 200 && fidelity < 60;
  const screenFidelity = usePreScreen ? 60 : fidelity;
  // At fidelity=60, a token needs minPoints/(60/fidelity) points to qualify
  // e.g. 500 points at fidelity=15 = 125 points at fidelity=60
  const screenMinPoints = usePreScreen ? Math.ceil(minPoints * fidelity / 60) : minPoints;
  
  // Auto-set volume floor when looking for data-rich markets
  // High-volume markets tend to be longer-lived (not 5-min crypto bets)
  const effectiveMinVolume = minVolume > 0 ? minVolume : (minPoints >= 100 ? 500000 : 0);
  
  if (usePreScreen) {
    console.log(`Pre-screening at fidelity=${screenFidelity} (need >=${screenMinPoints} pts), then re-fetching at fidelity=${fidelity}`);
  }
  if (effectiveMinVolume > 0) {
    console.log(`Volume filter: >=$${effectiveMinVolume.toLocaleString()} (skips short-lived markets)`);
  }

  const marketBatchSize = 500;
  const priceBatchSize = 30;
  let marketOffset = 0;
  let exhaustedMarkets = false;

  const progressBar = new cliProgress.SingleBar({
    format: 'Collecting |{bar}| {value}/{total} qualified markets | {scanned} scanned | {skipped} skipped',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  progressBar.start(limit, 0, { scanned: 0, skipped: 0 });
  let skippedCount = 0;

  // Pre-screen options use fidelity=60 for speed
  const screenOptions = { ...options, fidelity: screenFidelity };

  while (qualifiedMarkets.length < limit && !exhaustedMarkets) {
    // Fetch a batch of markets
    const params = new URLSearchParams();
    params.set('limit', String(marketBatchSize));
    params.set('offset', String(marketOffset));
    // Sort by volume desc when filtering by volume — gets best candidates first
    if (effectiveMinVolume > 0) {
      params.set('order', 'volume');
      params.set('ascending', 'false');
      params.set('volume_num_min', String(effectiveMinVolume));
    } else {
      params.set('order', 'createdAt');
      params.set('ascending', 'false');
    }
    if (active) {
      params.set('active', 'true');
      params.set('closed', 'false');
    }

    const response = await fetch(`${GAMMA_API}/markets?${params}`);
    if (!response.ok) {
      progressBar.stop();
      throw new Error(`Failed to fetch markets: ${response.statusText}`);
    }

    const rawMarkets = (await response.json()) as any[];
    if (rawMarkets.length === 0) {
      exhaustedMarkets = true;
      break;
    }

    marketOffset += rawMarkets.length;
    if (rawMarkets.length < marketBatchSize) {
      exhaustedMarkets = true;
    }

    // Parse markets
    const parsedMarkets = rawMarkets.map(parseMarket);

    // Build token list with end dates
    const tokenInfos: { tokenId: string; endTimestamp: number }[] = [];
    for (const market of parsedMarkets) {
      const endTimestamp = market.end_date_iso 
        ? Math.floor(new Date(market.end_date_iso).getTime() / 1000) 
        : 0;
      for (const token of market.tokens) {
        if (token.token_id) {
          tokenInfos.push({ tokenId: token.token_id, endTimestamp });
        }
      }
    }

    // Pass 1: Pre-screen at fidelity=60 (fast)
    const qualifyingTokenIds = new Set<string>();
    for (let i = 0; i < tokenInfos.length; i += priceBatchSize) {
      const batch = tokenInfos.slice(i, i + priceBatchSize);

      const promises = batch.map(async ({ tokenId, endTimestamp }) => {
        const history = await fetchPriceHistory(tokenId, screenOptions);
        return { tokenId, history, endTimestamp };
      });

      const results = await Promise.all(promises);

      for (const { tokenId, history, endTimestamp } of results) {
        if (history.length > 0) {
          let filteredHistory = options.months 
            ? history.filter(point => point.t >= cutoffTimestamp)
            : history;
          
          // Filter out price data after the market's end date
          if (endTimestamp > 0) {
            filteredHistory = filteredHistory.filter(point => point.t <= endTimestamp);
          }
          
          if (filteredHistory.length >= screenMinPoints) {
            if (usePreScreen) {
              // Mark as qualifying, will re-fetch at target fidelity
              qualifyingTokenIds.add(tokenId);
            } else {
              // No pre-screen needed, use directly
              priceHistory.set(tokenId, filteredHistory);
              totalPricePoints += filteredHistory.length;
            }
          } else {
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      }

      progressBar.update(qualifiedMarkets.length, { scanned: marketOffset, skipped: skippedCount });

      if (i + priceBatchSize < tokenInfos.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Pass 2: Re-fetch qualifying tokens at target fidelity
    if (usePreScreen && qualifyingTokenIds.size > 0) {
      const qualifyingInfos = tokenInfos.filter(t => qualifyingTokenIds.has(t.tokenId));
      for (let i = 0; i < qualifyingInfos.length; i += priceBatchSize) {
        const batch = qualifyingInfos.slice(i, i + priceBatchSize);

        const promises = batch.map(async ({ tokenId, endTimestamp }) => {
          const history = await fetchPriceHistory(tokenId, options); // uses target fidelity
          return { tokenId, history, endTimestamp };
        });

        const results = await Promise.all(promises);

        for (const { tokenId, history, endTimestamp } of results) {
          if (history.length > 0) {
            let filteredHistory = options.months 
              ? history.filter(point => point.t >= cutoffTimestamp)
              : history;
            
            if (endTimestamp > 0) {
              filteredHistory = filteredHistory.filter(point => point.t <= endTimestamp);
            }
            
            if (filteredHistory.length >= minPoints) {
              priceHistory.set(tokenId, filteredHistory);
              totalPricePoints += filteredHistory.length;
            }
          }
        }

        if (i + priceBatchSize < qualifyingInfos.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }

    // Check which markets from this batch have qualifying tokens
    for (const market of parsedMarkets) {
      if (qualifiedMarkets.length >= limit) break;
      const hasQualifyingToken = market.tokens.some(
        token => token.token_id && priceHistory.has(token.token_id)
      );
      if (hasQualifyingToken) {
        qualifiedMarkets.push(market);
      }
    }

    progressBar.update(qualifiedMarkets.length, { scanned: marketOffset, skipped: skippedCount });
  }

  progressBar.stop();

  // Remove price history for tokens not belonging to qualified markets
  const qualifiedTokenIds = new Set<string>();
  for (const market of qualifiedMarkets) {
    for (const token of market.tokens) {
      if (token.token_id) qualifiedTokenIds.add(token.token_id);
    }
  }
  for (const tokenId of priceHistory.keys()) {
    if (!qualifiedTokenIds.has(tokenId)) {
      totalPricePoints -= priceHistory.get(tokenId)!.length;
      priceHistory.delete(tokenId);
    }
  }

  console.log(`Scanned ${marketOffset} markets, kept ${qualifiedMarkets.length} with sufficient data`);

  const storedData: StoredData = {
    markets: qualifiedMarkets,
    priceHistory,
    collectionMetadata: {
      collectedAt: new Date().toISOString(),
      version: '1.0.0',
      totalMarkets: qualifiedMarkets.length,
      totalPricePoints,
    },
  };

  return storedData;
}

function parseMarket(m: any): Market {
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
