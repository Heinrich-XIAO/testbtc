import * as fs from 'fs';
import * as path from 'path';

interface StockDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const DATA_DIR = 'data';
const OUTPUT_FILE = 'data/stock-data.json';

interface StockMarket {
  ticker: string;
  condition_id: string;
  description: string;
  tokens: { outcome: string; token_id: string; price: number; winner: boolean }[];
}

const markets: StockMarket[] = [];
const priceHistory: Record<string, { t: number; p: number }[]> = {};

const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));

for (const file of files) {
  const ticker = file.replace('.json', '');
  const data: StockDataPoint[] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
  
  const tokenId = `stock_${ticker}`;
  
  const market: StockMarket = {
    ticker,
    condition_id: `stock_${ticker}`,
    description: `Stock ${ticker}`,
    tokens: [
      { outcome: ticker, token_id: tokenId, price: 0.5, winner: false }
    ]
  };
  markets.push(market);
  
  priceHistory[tokenId] = data.map(d => ({
    t: new Date(d.date).getTime(),
    p: d.close
  }));
}

const totalPricePoints = Object.values(priceHistory).reduce((sum, hist) => sum + hist.length, 0);

const output = {
  markets,
  priceHistory,
  collectionMetadata: {
    collectedAt: new Date().toISOString(),
    version: 'stock-1.0',
    totalMarkets: markets.length,
    totalPricePoints
  }
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));

console.log(`Created ${OUTPUT_FILE}`);
console.log(`Markets: ${markets.length}`);
console.log(`Total price points: ${totalPricePoints}`);
