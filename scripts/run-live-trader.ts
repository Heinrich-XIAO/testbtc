import { LiveTradingEngine } from '../src/trading/trading-engine';
import { SRNoTrendTightStoch309Strategy } from '../src/strategies/strat_sr_no_trend_tight_stoch_309';
import type { TradingConfig } from '../src/trading/types';
import { config } from 'dotenv';
import { existsSync } from 'fs';

async function main() {
  // Load .env.local if it exists
  const envPath = '.env.local';
  if (existsSync(envPath)) {
    config({ path: envPath });
    console.log('Loaded environment from .env.local');
  }
  
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  
  const tradingConfig: Partial<TradingConfig> = {
    initialCapital: 1000,
    maxPositionSize: 100,
    dryRun,
    pollIntervalMs: 60000,
  };

  const strategy = new SRNoTrendTightStoch309Strategy();
  
  // Get Discord credentials from environment
  const discordEmail = process.env.DISCORD_EMAIL;
  const discordPassword = process.env.DISCORD_PASSWORD;
  const discordCredentials = discordEmail && discordPassword 
    ? { email: discordEmail, password: discordPassword }
    : undefined;
  
  console.log('=== Polymarket Live Trading Engine ===');
  console.log(`Strategy: SR No Trend Tight Stoch 309`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no real trades)' : 'LIVE TRADING'}`);
  console.log(`Poll Interval: ${tradingConfig.pollIntervalMs! / 1000}s`);
  console.log(`Discord Auto-login: ${discordCredentials ? 'Enabled' : 'Disabled (manual login)'}`);
  console.log('');
  
  const engine = new LiveTradingEngine(strategy, tradingConfig, discordCredentials);
  
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down...');
    await engine.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await engine.stop();
    process.exit(0);
  });

  try {
    await engine.start();
  } catch (error) {
    console.error('Fatal error:', error);
    await engine.stop();
    process.exit(1);
  }
}

main();
