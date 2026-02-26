import YahooFinance from 'yahoo-finance2';
import * as fs from 'fs';
import * as path from 'path';

const yahooFinance = new YahooFinance();
const OUTPUT_DIR = 'data';
const TOP_N = 500;
const MIN_YEARS = 5;

async function getTopVolumeTickers(): Promise<string[]> {
  console.log('Fetching top volume tickers from S&P 500...');
  
  const tickers = [
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
    'TGT', 'BK', 'BDN', 'AME', 'PCAR', 'MSCI', 'DHI', 'A', 'IQV', 'FAST',
    'GPN', 'APTV', 'CMI', 'KMI', 'VLO', 'HSY', 'OXY', 'KEYS', 'PPG', 'FTNT',
    'ANSS', 'HES', 'PAYX', 'VRSK', 'WELL', 'CPRT', 'DOW', 'HLT', 'DLR', 'MKC',
    'TFC', 'VMC', 'ROK', 'EXC', 'WMB', 'EA', 'YUM', 'OTIS', 'USB', 'SYY',
    'DFS', 'STZ', 'BKR', 'K', 'RS', 'MAA', 'IFF', 'TSCO', 'DG', 'GLW',
    'AVY', 'ETR', 'CNP', 'WAB', 'VICI', 'EBAY', 'PCG', 'ED', 'F', 'DOV',
    'AEE', 'SWK', 'FTV', 'ARE', 'BIIB', 'VTR', 'CTLT', 'EXR', 'WEC', 'MLM',
    'ES', 'EXPE', 'DAL', 'RMD', 'AWK', 'ROST', 'WBA', 'TROW', 'GL', 'KEY',
    'LYB', 'AAL', 'PTC', 'HAL', 'HIG', 'IT', 'NTRS', 'PFG', 'CFG', 'URI',
    'J', 'KIM', 'LUV', 'ALB', 'BBY', 'CBRE', 'CDW', 'CMS', 'DRI', 'EVRG',
    'FE', 'HBAN', 'HPE', 'IDXX', 'LVS', 'MTD', 'PPL', 'RHI', 'SYF', 'TPR',
    'TRMB', 'TSN', 'UAL', 'VRSN', 'WAT', 'XYL', 'ZBH', 'ZION', 'AIG', 'AAL'
  ];
  
  const uniqueTickers = [...new Set(tickers)];
  const tickersWithVolume: { ticker: string; volume: number }[] = [];
  
  console.log(`Checking ${uniqueTickers.length} tickers for historical data...`);
  
  for (const ticker of uniqueTickers) {
    try {
      const quote: any = await yahooFinance.quote(ticker);
      const hist: any = await yahooFinance.historical(ticker, {
        period1: new Date(Date.now() - MIN_YEARS * 365 * 24 * 60 * 60 * 1000),
        period2: new Date(),
        interval: '1d'
      });
      
      if (hist && hist.length > MIN_YEARS * 250) {
        tickersWithVolume.push({
          ticker,
          volume: quote.averageDailyVolume10Day || quote.averageDailyVolume3Month || 0
        });
        console.log(`✓ ${ticker}: ${hist.length} days, volume: ${quote.averageDailyVolume10Day || 'N/A'}`);
      }
    } catch (e) {
      console.log(`✗ ${ticker}: failed`);
    }
  }
  
  tickersWithVolume.sort((a, b) => b.volume - a.volume);
  return tickersWithVolume.slice(0, TOP_N).map(t => t.ticker);
}

async function downloadHistoricalData(tickers: string[]) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const startDate = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);
  
  console.log(`Downloading 5 years of daily data for ${tickers.length} tickers...`);
  
  const errors: string[] = [];
  
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    try {
      console.log(`[${i + 1}/${tickers.length}] Downloading ${ticker}...`);
      const hist: any = await yahooFinance.historical(ticker, {
        period1: startDate,
        period2: new Date(),
        interval: '1d'
      });
      
      if (hist && hist.length > 0) {
        const data = hist.map((d: any) => ({
          date: d.date.toISOString().split('T')[0],
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume
        }));
        
        fs.writeFileSync(
          path.join(OUTPUT_DIR, `${ticker}.json`),
          JSON.stringify(data, null, 2)
        );
        console.log(`  ✓ Saved ${data.length} days`);
      }
    } catch (e: any) {
      console.log(`  ✗ ${ticker}: ${e.message}`);
      errors.push(ticker);
    }
  }
  
  console.log(`\nCompleted! ${tickers.length - errors.length} tickers downloaded, ${errors.length} failed`);
}

async function main() {
  const tickers = await getTopVolumeTickers();
  console.log(`\nTop ${tickers.length} tickers by volume: ${tickers.join(', ')}`);
  await downloadHistoricalData(tickers);
}

main().catch(console.error);
