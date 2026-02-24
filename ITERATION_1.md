# ITERATION 1 - Support/Resistance Confirmation

**Date:** 2026-02-22
**Phase:** Phase 1 - Baseline & Discovery
**Number of Strategies:** 3

## Summary

Added support/resistance confirmation to stochastic strategies. Much better results than baseline.

## Strategy Summary Table

| # | Strategy | Logic | Small Return | Large Return | Win Rate | Trades | Status |
|---|----------|-------|--------------|--------------|----------|--------|--------|
| 1 | sr_stoch_01 | Stoch + support confirmation | $85 (8.5%) | - | 65.8% | 397 | ⚠️ Small win |
| 2 | sr_stoch_02 | Stoch + bounce confirmation | $17% | 5.3% | 31.8% | 44/582 | ⚠️ Small win |
| 3 | sr_stoch_03 | Stoch + resistance exit | $504 (50.4%) | $468 (47%) | 80.9% | 652/13086 | ✅ WINNER |

## Key Insights

1. **sr_stoch_03 is a winner** - 50% return on small, 47% on large with high win rate
2. **Resistance exit helps** - Taking profits at resistance improves results
3. **Support confirmation alone not enough** - Need both support and resistance logic

## Next Iteration Ideas

1. Combine sr_stoch_03 logic with momentum filter
2. Try tighter stochastic settings
3. Test wider lookback periods
