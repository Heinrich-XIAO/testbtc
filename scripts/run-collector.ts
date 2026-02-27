import { Command } from 'commander';
import YahooFinance from 'yahoo-finance2';
import cliProgress from 'cli-progress';
import * as fs from 'fs';
import * as path from 'path';

interface DownloadOptions {
  outputDir: string;
  years: number;
  minYears: number;
  interval: HistInterval;
  limit: number;
  tickers?: string;
  source: 'wikipedia' | 'builtin';
}

type HistInterval = '1d' | '1wk' | '1mo';

const yahooFinance = new YahooFinance({
  validation: { logErrors: false }
});

const DEFAULT_OUTPUT_DIR = 'data';
const DEFAULT_LIMIT = 500;
const DEFAULT_MIN_YEARS = 5;
const DEFAULT_YEARS = 5;
const DEFAULT_INTERVAL: HistInterval = '1d';
const DEFAULT_SOURCE: 'wikipedia' | 'builtin' = 'wikipedia';

// Fallback tickers if Wikipedia fetch fails
const FALLBACK_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B', 'LLY', 'AVGO',
  'V', 'JPM', 'WMT', 'XOM', 'MA', 'UNH', 'PG', 'COST', 'JNJ', 'HD',
  'MRK', 'ABBV', 'KO', 'PEP', 'CVX', 'BAC', 'ADBE', 'CRM', 'AMD', 'NFLX',
  'TMO', 'MCD', 'CSCO', 'ACN', 'ABT', 'DIS', 'WFC', 'DHR', 'CMCSA', 'NKE',
  'VZ', 'INTC', 'NEE', 'PM', 'TXN', 'BMY', 'UNP', 'RTX', 'LOW', 'HON',
  'QCOM', 'AMGN', 'IBM', 'BA', 'GE', 'CAT', 'SBUX', 'INTU', 'AMAT', 'GS',
  'BLK', 'AXP', 'ISRG', 'MDLZ', 'GILD', 'BKNG', 'SYK', 'CI', 'MMC', 'TJX',
  'ADP', 'VRTX', 'CVS', 'ZTS', 'MO', 'REGN', 'PLD', 'BDX', 'CB', 'SO',
  'DUK', 'PNC', 'T', 'BSX', 'ITW', 'CL', 'ETN', 'NOC', 'CME', 'EOG',
  'APD', 'SHW', 'WM', 'MMM', 'AON', 'FIS', 'EQIX', 'HUM', 'ICE', 'NSC',
  'MCO', 'KLAC', 'SNPS', 'CDNS', 'MAR', 'TT', 'ORLY', 'PGR', 'MSI', 'ECL',
  'NXPI', 'AJG', 'TEL', 'FI', 'CTAS', 'EMR', 'GM', 'SLB', 'ROP', 'HCA',
  'PSX', 'CMG', 'MCHP', 'PH', 'FDX', 'COF', 'EIX', 'MCK', 'EW', 'PSA',
  'LHX', 'TDY', 'MPC', 'NEM', 'AEP', 'AZO', 'SRE', 'CNC', 'JCI', 'TRV',
  'KMB', 'AFL', 'D', 'RSG', 'AIG', 'O', 'ORCL', 'PRU', 'CTSH', 'LRCX',
  'KHC', 'SPGI', 'MU', 'LH', 'ADSK', 'CARR', 'MNST', 'TMUS', 'DD', 'AMP',
  'TGT', 'BK', 'AME', 'PCAR', 'MSCI', 'DHI', 'A', 'IQV', 'FAST',
  'GPN', 'APTV', 'CMI', 'KMI', 'VLO', 'HSY', 'OXY', 'KEYS', 'PPG', 'FTNT',
  'ANSS', 'HES', 'PAYX', 'VRSK', 'WELL', 'CPRT', 'DOW', 'HLT', 'DLR', 'MKC',
  'TFC', 'VMC', 'ROK', 'EXC', 'WMB', 'EA', 'YUM', 'OTIS', 'USB', 'SYY',
  'DFS', 'STZ', 'BKR', 'RS', 'MAA', 'IFF', 'TSCO', 'DG', 'GLW',
  'AVY', 'ETR', 'CNP', 'WAB', 'VICI', 'EBAY', 'PCG', 'ED', 'F', 'DOV',
  'AEE', 'SWK', 'FTV', 'ARE', 'BIIB', 'VTR', 'EXR', 'WEC', 'MLM',
  'ES', 'EXPE', 'DAL', 'RMD', 'AWK', 'ROST', 'WBA', 'TROW', 'GL', 'KEY',
  'LYB', 'AAL', 'PTC', 'HAL', 'HIG', 'IT', 'NTRS', 'PFG', 'CFG', 'URI',
  'J', 'KIM', 'LUV', 'ALB', 'BBY', 'CBRE', 'CDW', 'CMS', 'DRI', 'EVRG',
  'FE', 'HBAN', 'HPE', 'IDXX', 'LVS', 'MTD', 'PPL', 'RHI', 'SYF', 'TPR',
  'TRMB', 'TSN', 'UAL', 'VRSN', 'WAT', 'XYL', 'ZBH', 'ZION', 'AES', 'AOS',
  'APA', 'ATO', 'BALL', 'BAX', 'BBWI', 'BEN', 'BF-B', 'BIO', 'BXP', 'CAG',
  'CAH', 'CBOE', 'CCL', 'CF', 'CHD', 'CHRW', 'CINF', 'CLX', 'CMA',
  'COO', 'CPB', 'CRL', 'CSX', 'CPT', 'CTRA', 'DGX', 'DVN', 'EG', 'EL',
  'ELV', 'EMN', 'EPAM', 'ESS', 'FANG', 'FDS', 'FFIV', 'FMC', 'FOX', 'FOXA',
  'FR', 'FTV', 'GD', 'GIS', 'GNRC', 'GOOG', 'GPC', 'GWW', 'HII',
  'HOLX', 'HPQ', 'HRL', 'HSIC', 'HST', 'IEX', 'IP', 'IPG', 'IRM',
  'JBHT', 'JBL', 'JKHY', 'JNPR', 'KDP', 'KMX', 'KR', 'L', 'LDOS',
  'LEN', 'LNT', 'LYV', 'MAS', 'MAT', 'MDT', 'MET', 'MGM', 'MHK', 'MKTX',
  'MOH', 'MOS', 'MPWR', 'MRNA', 'MTB', 'MTCH', 'NDAQ', 'NDSN', 'NI', 'NOW',
  'NRG', 'NTAP', 'NUE', 'NVR', 'NWL', 'NWS', 'NWSA', 'OKE', 'OMC', 'ON',
  'PANW', 'PARA', 'PAYC', 'PHM', 'PKG', 'PNR', 'PNW', 'POOL', 'PWR', 'PXD',
  'PYPL', 'QRVO', 'RCL', 'RE', 'REG', 'RF', 'RJF', 'RL', 'ROL', 'RVTY',
  'SBAC', 'SCHW', 'SEE', 'SJM', 'SNA', 'SNOW', 'SPG', 'STE', 'STLD', 'STT',
  'STX', 'SWKS', 'TAP', 'TDG', 'TECH', 'TFX', 'TPR', 'TRGP', 'TTWO', 'TXT',
  'TYL', 'UDR', 'UHS', 'ULTA', 'UNM', 'UPS', 'VFC', 'VMC', 'VNO',
  'VOO', 'VTRS', 'WLK', 'WOOF', 'WPC', 'WRB', 'WRK', 'WST', 'WTW', 'WY',
  'WYNN', 'XEL', 'XRAY', 'ZTS', 'ZEBRA'
];

async function fetchWikipediaTickers(): Promise<string[]> {
  const tickers: string[] = [];
  
  // Fetch S&P 500 (use the & character, not encoded)
  console.log('Fetching S&P 500 tickers from Wikipedia...');
  try {
    const sp500 = await fetchWikipediaTable('List_of_S&P_500_companies', 'Symbol');
    tickers.push(...sp500);
    console.log(`  ✓ Got ${sp500.length} S&P 500 tickers`);
  } catch (e) {
    console.log('  ✗ Failed to fetch S&P 500');
  }
  
  // Fetch S&P 400
  console.log('Fetching S&P 400 tickers from Wikipedia...');
  try {
    const sp400 = await fetchWikipediaTable('List_of_S&P_400_companies', 'Symbol');
    tickers.push(...sp400);
    console.log(`  ✓ Got ${sp400.length} S&P 400 tickers`);
  } catch (e) {
    console.log('  ✗ Failed to fetch S&P 400');
  }
  
  // Fetch S&P 600
  console.log('Fetching S&P 600 tickers from Wikipedia...');
  try {
    const sp600 = await fetchWikipediaTable('List_of_S&P_600_companies', 'Symbol');
    tickers.push(...sp600);
    console.log(`  ✓ Got ${sp600.length} S&P 600 tickers`);
  } catch (e) {
    console.log('  ✗ Failed to fetch S&P 600');
  }
  
  const unique = [...new Set(tickers)];
  console.log(`\nTotal unique tickers from Wikipedia: ${unique.length}\n`);
  return unique;
}

async function fetchWikipediaTable(page: string, symbolColumn: string): Promise<string[]> {
  // Use Wikipedia API for cleaner JSON response
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&origin=*`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json() as { parse?: { text?: { '*': string } } };
  const html = data.parse?.text?.['*'] || '';
  const tickers: string[] = [];
  
  // Extract tickers from table cells with links
  // Pattern: <td><a href="...">TICKER</a></td>
  const symbolRegex = /<td[^>]*>\s*<a[^>]*href="[^"]*"[^>]*>([A-Z\.\-]{1,5})<\/a>\s*<\/td>/g;
  let match;
  
  while ((match = symbolRegex.exec(html)) !== null) {
    const ticker = match[1].replace(/\./g, '-');
    if (!tickers.includes(ticker)) {
      tickers.push(ticker);
    }
  }
  
  return tickers;
}

function parseNumberOption(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }
  return parsed;
}

function parseIntervalOption(value: string): HistInterval {
  if (value === '1d' || value === '1wk' || value === '1mo') {
    return value;
  }
  throw new Error('--interval must be one of: 1d, 1wk, 1mo');
}

function parseSourceOption(value: string): 'wikipedia' | 'builtin' {
  if (value === 'wikipedia' || value === 'builtin') {
    return value;
  }
  throw new Error('--source must be one of: wikipedia, builtin');
}

async function getTickerUniverse(source: 'wikipedia' | 'builtin', customTickers?: string): Promise<string[]> {
  if (customTickers) {
    return [...new Set(
      customTickers
        .split(',')
        .map((ticker) => ticker.trim().toUpperCase())
        .filter((ticker) => ticker.length > 0)
    )];
  }
  
  if (source === 'wikipedia') {
    const wikiTickers = await fetchWikipediaTickers();
    if (wikiTickers.length >= 500) {
      return wikiTickers;
    }
    console.log('Wikipedia fetch returned fewer than 500 tickers, using fallback...');
    return FALLBACK_TICKERS;
  }
  
  return FALLBACK_TICKERS;
}

async function getTopVolumeTickers(options: DownloadOptions): Promise<string[]> {
  const universe = await getTickerUniverse(options.source, options.tickers);
  const tickersWithVolume: { ticker: string; volume: number }[] = [];

  console.log(`Checking ${universe.length} tickers for >=${options.minYears} years of history...`);

  const progressBar = new cliProgress.SingleBar({
    format: 'Scanning |{bar}| {percentage}% | {value}/{total} | Current: {ticker}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  progressBar.start(universe.length, 0, { ticker: '' });

  for (const ticker of universe) {
    try {
      const quote: any = await yahooFinance.quote(ticker);
      const hist: any = await yahooFinance.historical(ticker, {
        period1: new Date(Date.now() - options.minYears * 365 * 24 * 60 * 60 * 1000),
        period2: new Date(),
        interval: options.interval
      });

      if (hist && hist.length > options.minYears * 250) {
        tickersWithVolume.push({
          ticker,
          volume: quote.averageDailyVolume10Day || quote.averageDailyVolume3Month || 0
        });
      }
    } catch {
      // Skip failed tickers silently
    }
    progressBar.increment({ ticker });
  }

  progressBar.stop();
  tickersWithVolume.sort((a, b) => b.volume - a.volume);
  return tickersWithVolume.slice(0, options.limit).map((entry) => entry.ticker);
}

async function downloadHistoricalData(tickers: string[], options: DownloadOptions): Promise<void> {
  if (!fs.existsSync(options.outputDir)) {
    fs.mkdirSync(options.outputDir, { recursive: true });
  }

  const startDate = new Date(Date.now() - options.years * 365 * 24 * 60 * 60 * 1000);

  console.log(`Downloading ~${options.years} years of ${options.interval} data for ${tickers.length} tickers...`);

  const errors: string[] = [];

  const progressBar = new cliProgress.SingleBar({
    format: 'Downloading |{bar}| {percentage}% | {value}/{total} | {ticker}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  progressBar.start(tickers.length, 0, { ticker: '' });

  for (const ticker of tickers) {
    try {
      const hist: any = await yahooFinance.historical(ticker, {
        period1: startDate,
        period2: new Date(),
        interval: options.interval
      });

      if (hist && hist.length > 0) {
        const data = hist.map((entry: any) => ({
          date: entry.date.toISOString().split('T')[0],
          open: entry.open,
          high: entry.high,
          low: entry.low,
          close: entry.close,
          volume: entry.volume
        }));

        fs.writeFileSync(
          path.join(options.outputDir, `${ticker}.json`),
          JSON.stringify(data, null, 2)
        );
      } else {
        errors.push(ticker);
      }
    } catch (error: any) {
      errors.push(ticker);
    }
    progressBar.increment({ ticker });
  }

  progressBar.stop();
  console.log(`\nCompleted. ${tickers.length - errors.length} downloaded, ${errors.length} failed.`);
}

const program = new Command();

program
  .name('run-collector')
  .description('Download stock OHLCV JSON files into a data directory')
  .option('-o, --output-dir <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
  .option('-y, --years <number>', 'Years of history to download', String(DEFAULT_YEARS))
  .option('--min-years <number>', 'Minimum history required before selection', String(DEFAULT_MIN_YEARS))
  .option('-i, --interval <interval>', 'Yahoo Finance interval (e.g. 1d, 1wk, 1mo)', DEFAULT_INTERVAL)
  .option('-l, --limit <number>', 'Maximum number of tickers to download', String(DEFAULT_LIMIT))
  .option('-t, --tickers <csv>', 'Optional CSV ticker override (example: AAPL,MSFT,NVDA)')
  .option('-s, --source <source>', 'Ticker source: wikipedia (S&P 500+400+600) or builtin', DEFAULT_SOURCE)
  .showHelpAfterError('(add --help for additional information)')
  .action(async (rawOptions) => {
    const options: DownloadOptions = {
      outputDir: rawOptions.outputDir,
      years: parseNumberOption(rawOptions.years, '--years'),
      minYears: parseNumberOption(rawOptions.minYears, '--min-years'),
      interval: parseIntervalOption(rawOptions.interval),
      limit: parseNumberOption(rawOptions.limit, '--limit'),
      tickers: rawOptions.tickers,
      source: parseSourceOption(rawOptions.source)
    };

    console.log('Stock Data Collector');
    console.log('====================');
    console.log(`Output dir: ${options.outputDir}`);
    console.log(`Interval:   ${options.interval}`);
    console.log(`Years:      ${options.years}`);
    console.log(`Min years:  ${options.minYears}`);
    console.log(`Limit:      ${options.limit}`);
    console.log(`Source:     ${options.source}`);
    if (options.tickers) {
      console.log(`Universe:   custom (${options.tickers})`);
    }
    console.log('');

    const tickers = await getTopVolumeTickers(options);
    console.log(`Selected ${tickers.length} tickers by volume.\n`);
    await downloadHistoricalData(tickers, options);
  });

program.parse();
