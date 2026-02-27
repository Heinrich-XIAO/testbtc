# ITERATION_165

**Date:** 2026-02-27
**Phase:** Fee Survival Testing

## Goal
Test 5 new strategy concepts designed to reduce trade count and survive realistic broker fees (0.1%).

## Strategy Concepts

1. **A: Higher Timeframe (Weekly)** - Trade only on weekly patterns to reduce trade count
2. **B: Volume Confirmation** - Only enter when volume > 1.5x average
3. **C: Multi-Bar Confirmation** - Require 3 consecutive bullish bars before entry
4. **D: Volatility Filter** - Only trade when ATR > threshold
5. **E: Trend Following** - Only trade in established trends (MA slope)

## Results Summary

| Rank | Strategy | Return ($) | Return (%) | Trades | Win Rate | Status |
|------|----------|------------|------------|--------|----------|--------|
| 1 | D: Volatility Filter | $39.58 | -96.0% | 2 | 50.0% | ❌ FAILED |
| 2 | B: Volume Confirmation | $0.00 | -100.0% | 0 | 0.0% | ❌ NO TRADES |
| 3 | C: Multi-Bar Confirmation | $0.00 | -100.0% | 0 | 0.0% | ❌ NO TRADES |
| 4 | E: Trend Following | $0.00 | -100.0% | 0 | 0.0% | ❌ NO TRADES |
| 5 | A: Higher Timeframe | $-23.14 | -102.3% | 2 | 0.0% | ❌ FAILED |

**All 5 strategies failed to survive 0.1% fees.**

## Comparison to Best Known

| Strategy | 0% Fees | 0.1% Fees | Trades |
|----------|---------|-----------|--------|
| StratIterStock013 (baseline) | +$205.57 (+20.6%) | -$186.61 (-18.7%) | 161,141 |
| ITERATION_165 Best (Vol Filter) | N/A | -$960.42 (-96.0%) | 2 |

## Key Insights

1. **Trade count too low**: Strategies B, C, E made 0 trades - filters too restrictive
2. **Higher timeframe failed**: Strategy A only made 2 trades, both losers
3. **Volatility filter best but still bad**: Strategy D made 2 trades (50% win) but fees killed it
4. **Filtering out trades is hard**: All attempts to reduce trade count eliminated profitable opportunities

## What We Learned

### What Doesn't Work
- Weekly timeframe: Not enough signals on 5-year daily data
- Volume confirmation: Too restrictive, filters out all setups
- Multi-bar confirmation: Too restrictive, 0 trades
- Volatility filter: Too restrictive, only 2 trades
- Trend following with MA slope: Too restrictive, 0 trades

### The Trade Count Problem
- Original best strategy: 161,141 trades → survives 0% fees, dies at 0.1% fees
- New strategies: 0-2 trades → too few to be meaningful
- **There's a sweet spot we're missing**: Need ~500-5000 trades, not 0 or 161K

## Recommendation

**Don't use these strategies.** All failed. 

**Next iteration focus**: Find strategies that:
1. Make 500-5000 trades (not 0, not 161K)
2. Have 50%+ win rate
3. Use larger position sizes (reduce number of trades)

## Files Created

- `src/strategies/strat_iter165_a.ts` - Higher Timeframe
- `src/strategies/strat_iter165_a.optimization.ts`
- `src/strategies/strat_iter165_b.ts` - Volume Confirmation
- `src/strategies/strat_iter165_b.optimization.ts`
- `src/strategies/strat_iter165_c.ts` - Multi-Bar Confirmation
- `src/strategies/strat_iter165_c.optimization.ts`
- `src/strategies/strat_iter165_d.ts` - Volatility Filter
- `src/strategies/strat_iter165_d.optimization.ts`
- `src/strategies/strat_iter165_e.ts` - Trend Following
- `src/strategies/strat_iter165_e.optimization.ts`

## Status: COMPLETE (All Failed)
