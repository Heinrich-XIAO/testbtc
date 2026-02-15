# PolySimulator Live Trading Integration

This module enables live paper trading on PolySimulator using your optimized strategies.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Trading Strategy                    │
│    (strat_sr_no_trend_tight_stoch_309)              │
└─────────────────────┬───────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────────────────┐
│ Polymarket API  │     │ PolySimulator (Playwright)  │
│ (Market Data)   │     │ (Paper Trading Execution)   │
│                 │     │                             │
│ • Prices        │     │ • Login + Session           │
│ • Orderbooks    │     │ • Place Orders              │
│ • Market info   │     │ • Check Positions           │
└─────────────────┘     └─────────────────────────────┘
```

## Files

- `polysimulator-client.ts` - Playwright browser automation for PolySimulator
- `polymarket-data-client.ts` - REST API client for real Polymarket market data
- `trading-engine.ts` - Bridge between strategy logic and execution
- `types.ts` - TypeScript types for trading operations

## Usage

### Dry Run (default - no real trades)
```bash
bun run trade
```

### Live Trading (requires manual login)
```bash
bun run trade:live
```

## How It Works

1. **Init**: Opens a browser to PolySimulator, waits for you to log in
2. **Load Markets**: Fetches active markets from Polymarket API
3. **Update Prices**: Polls current prices for all tracked tokens
4. **Evaluate Strategy**: Runs strategy logic on each token
5. **Execute Signals**: Places orders via browser automation
6. **Loop**: Repeats every 60 seconds

## Strategy

Uses `strat_sr_no_trend_tight_stoch_309` - the best performer from optimization:
- $163.83 test return
- Tight stochastic (18/80)
- Support/resistance entry
- Trailing stop exit

## Configuration

Edit `TradingConfig` in `run-live-trader.ts`:
- `initialCapital` - Starting balance
- `maxPositionSize` - Max shares per position
- `dryRun` - Set false to enable real trades
- `pollIntervalMs` - How often to check for signals

## PolySimulator Notes

PolySimulator does not have a public API yet. This module uses Playwright browser automation to:
- Navigate to market pages
- Click Buy/Sell buttons
- Enter order amounts
- Submit orders

The UI selectors are generic and may need adjustment as PolySimulator evolves.