# ITERATION_166

**Date:** 2026-02-27
**Phase:** Fee Survival - Trade Count Optimization

## Goal
Test 5 strategies designed to hit the "sweet spot" of 500-5000 trades (not 0, not 161K).

## Strategy Concepts

1. **A: Fixed Position Count** - Minimum hold bars to force fewer trades
2. **B: Larger Position Sizing** - 50-80% risk per trade
3. **C: Cooldown Period** - Wait N bars after exit before re-entry
4. **D: Top N Markets Only** - Trade only top 100-200 by volume
5. **E: Consecutive Loss Limit** - Pause after 3 losses

## Results

| Rank | Strategy | Return | Trades | Win Rate |
|------|----------|--------|--------|----------|
| 1 | B: Larger Position Sizing | -91.1% | 4 | 25% |
| 2 | A: Fixed Position Count | -92.1% | 1 | 0% |
| 3 | C: Cooldown Period | -100% | 0 | 0% |
| 4 | D: Top N Markets Only | -100% | 0 | 0% |
| 5 | E: Consecutive Loss Limit | -102.8% | 2 | 0% |

**All 5 strategies failed.**

## Key Problem
- Trade counts: 0-4 trades (WAY too low)
- We're over-correcting from 161K trades to 0-4 trades
- Need something in the middle: 500-5000 trades

## Learning
Minimum hold periods and cooldowns are TOO restrictive. They eliminate almost all trades. We need a different approach.

## Status: COMPLETE (All Failed)
