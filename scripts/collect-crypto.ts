import { Command } from 'commander';
import cliProgress from 'cli-progress';
import kleur from 'kleur';
import * as fs from 'fs';
import * as path from 'path';

interface DownloadOptions {
  outputDir: string;
  symbols: string[];
  interval: string;
  days: number;
}

const DEFAULT_OUTPUT_DIR = 'data/crypto';
const DEFAULT_INTERVAL = '1d'; // 1m, 5m, 15m, 1h, 4h, 1d
const DEFAULT_DAYS = 365 * 2; // 2 years

// Top 100 crypto pairs by volume (USDT pairs)
const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'TONUSDT',
  'ADAUSDT', 'AVAXUSDT', 'SHIBUSDT', 'DOTUSDT', 'LINKUSDT', 'BCHUSDT', 'LTCUSDT',
  'UNIUSDT', 'MATICUSDT', 'ICPUSDT', 'NEARUSDT', 'LEOUSDT', 'APTUSDT', 'AAVEUSDT',
  'ETCUSDT', 'XLMUSDT', 'TIAUSDT', 'STXUSDT', 'FILUSDT', 'RNDRUSDT', 'ATOMUSDT',
  'IMXUSDT', 'ARBUSDT', 'OPUSDT', 'MKRUSDT', 'WLDUSDT', 'INJUSDT', 'GRTUSDT',
  'FLOWUSDT', 'PEPEUSDT', 'SANDUSDT', 'FETUSDT', 'MANAUSDT', 'XTZUSDT', 'ALGOUSDT',
  'EGLDUSDT', 'THETAUSDT', 'AXSUSDT', 'QNTUSDT', 'FTMUSDT', 'NEOUSDT', 'RUNEUSDT',
  'SEIUSDT', 'KAVAUSDT', 'BEAMUSDT', 'PYTHUSDT', 'MINAUSDT', 'LDOUSDT', 'SUIUSDT',
  'SNXUSDT', 'PENDLEUSDT', 'DYDXUSDT', 'STRKUSDT', 'JUPUSDT', 'ENSUSDT', 'ARUSDT',
  'WOOUSDT', 'CKBUSDT', 'CAKEUSDT', 'ZROUSDT', 'GLMRUSDT', 'COMPUSDT', 'WIFUSDT',
  'LUNCUSDT', 'ONDOUSDT', 'BOMEUSDT', 'BONKUSDT', 'PEOPLEUSDT', 'FLOKIUSDT',
  'WUSDT', 'JASMYUSDT', 'ETHFIUSDT', 'BATUSDT', 'ENJUSDT', 'GMTUSDT', 'ACHUSDT',
  '1INCHUSDT', 'IOTAUSDT', 'GMTUSDT', 'SUSHIUSDT', 'CRVUSDT', 'API3USDT', 'CVXUSDT',
  'SKLUSDT', 'RLCUSDT', 'CELOUSDT', 'MASKUSDT', 'ZRXUSDT', 'ANKRUSDT', 'LPTUSDT',
  'AUDIOUSDT', 'YFIUSDT', 'UMAUSDT', 'BICOUSDT', 'COTIUSDT', 'DASHUSDT', 'IOTXUSDT'
];

interface KlineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

interface CryptoMarket {
  symbol: string;
  condition_id: string;
  description: string;
  tokens: { outcome: string; token_id: string; price: number; winner: boolean }[];
}

async function fetchKlines(symbol: string, interval: string, startTime: number, endTime: number): Promise<KlineData[]> {
  const url = new URL('https://api.binance.com/api/v3/klines');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('interval', interval);
  url.searchParams.set('startTime', startTime.toString());
  url.searchParams.set('endTime', endTime.toString());
  url.searchParams.set('limit', '1000');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }

  const data = await response.json() as any[];
  // Binance returns array of arrays: [openTime, open, high, low, close, volume, closeTime, ...]
  return data.map((k: any[]) => ({
    openTime: k[0],
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
    volume: k[5],
    closeTime: k[6],
  }));
}

async function downloadSymbol(symbol: string, options: DownloadOptions): Promise<{ data: KlineData[]; count: number } | null> {
  const endTime = Date.now();
  const startTime = endTime - (options.days * 24 * 60 * 60 * 1000);
  
  const allData: KlineData[] = [];
  let currentStart = startTime;
  
  // Binance limits to 1000 candles per request, so we need pagination
  while (currentStart < endTime) {
    try {
      const chunk = await fetchKlines(symbol, options.interval, currentStart, endTime);
      if (chunk.length === 0) break;
      
      allData.push(...chunk);
      
      // Move start time to after the last candle
      const lastCloseTime = chunk[chunk.length - 1].closeTime;
      if (lastCloseTime >= endTime || lastCloseTime <= currentStart) break;
      currentStart = lastCloseTime + 1;
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.log(kleur.red(`\n  Error fetching ${symbol}: ${e}`));
      break;
    }
  }
  
  return allData.length > 0 ? { data: allData, count: allData.length } : null;
}

async function downloadCryptoData(options: DownloadOptions): Promise<void> {
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  const markets: CryptoMarket[] = [];
  const priceHistory: Record<string, { t: number; p: number }[]> = {};

  console.log(`Downloading ${options.interval} data for ${options.symbols.length} symbols...`);
  console.log(`Period: Last ${options.days} days\n`);

  const progressBar = new cliProgress.SingleBar({
    format: 'Downloading |{bar}| {percentage}% | {value}/{total} | {symbol}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  progressBar.start(options.symbols.length, 0, { symbol: '' });

  for (let i = 0; i < options.symbols.length; i++) {
    const symbol = options.symbols[i];
    progressBar.update(i, { symbol });

    try {
      const result = await downloadSymbol(symbol, options);
      
      if (result && result.data.length > 100) { // Minimum 100 candles
        const displaySymbol = symbol.replace('USDT', '');
        const tokenId = `crypto_${displaySymbol}`;
        
        markets.push({
          symbol: displaySymbol,
          condition_id: tokenId,
          description: `Crypto ${displaySymbol}`,
          tokens: [{ outcome: displaySymbol, token_id: tokenId, price: 0.5, winner: false }]
        });
        
        priceHistory[tokenId] = result.data.map(k => ({
          t: k.openTime,
          p: parseFloat(k.close)
        }));

        // Save individual file
        const fileData = result.data.map(k => ({
          date: new Date(k.openTime).toISOString().split('T')[0],
          open: parseFloat(k.open),
          high: parseFloat(k.high),
          low: parseFloat(k.low),
          close: parseFloat(k.close),
          volume: parseFloat(k.volume)
        }));
        
        fs.writeFileSync(
          path.join(options.outputDir, `${displaySymbol}.json`),
          JSON.stringify(fileData, null, 2)
        );
      }
    } catch (e) {
      // Skip failed symbols
    }
    
    progressBar.increment({ symbol });
  }

  progressBar.stop();

  // Create combined file for backtest
  const totalPricePoints = Object.values(priceHistory).reduce((sum, hist) => sum + hist.length, 0);
  
  const output = {
    markets,
    priceHistory,
    collectionMetadata: {
      collectedAt: new Date().toISOString(),
      version: 'crypto-1.0',
      totalMarkets: markets.length,
      totalPricePoints,
      interval: options.interval,
      days: options.days
    }
  };

  fs.writeFileSync(
    path.join(options.outputDir, '../crypto-data.json'),
    JSON.stringify(output)
  );

  console.log(`\nCompleted! Downloaded ${markets.length} symbols`);
  console.log(`Total price points: ${totalPricePoints.toLocaleString()}`);
  console.log(`Output: ${options.outputDir}`);
}

const program = new Command();

program
  .name('collect-crypto')
  .description('Download crypto OHLCV data from Binance')
  .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
  .option('-i, --interval <interval>', 'Candle interval (1m, 5m, 15m, 1h, 4h, 1d)', DEFAULT_INTERVAL)
  .option('-d, --days <number>', 'Number of days of history', String(DEFAULT_DAYS))
  .option('-s, --symbols <csv>', 'Comma-separated list of symbols (default: top 100)')
  .showHelpAfterError()
  .action(async (options) => {
    const opts: DownloadOptions = {
      outputDir: options.output,
      symbols: options.symbols ? options.symbols.split(',') : DEFAULT_SYMBOLS,
      interval: options.interval,
      days: parseInt(options.days)
    };

    console.log('Crypto Data Collector (Binance)');
    console.log('===============================');
    console.log(`Output:   ${opts.outputDir}`);
    console.log(`Interval: ${opts.interval}`);
    console.log(`Days:     ${opts.days}`);
    console.log(`Symbols:  ${opts.symbols.length}`);
    console.log('');

    await downloadCryptoData(opts);
  });

program.parse();
