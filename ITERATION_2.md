# ITERATION 2 - No Trend Filter & Wider Lookback

**Date:** 2026-02-22
**Phase:** Phase 1 - Baseline & Discovery

## Summary

Tested no trend filter and wider lookback variations.

## Strategy Summary Table

| # | Strategy | Logic | Small Return | Large Return | Win Rate | Status |
|---|----------|-------|--------------|--------------|----------|--------|
| 1 | iter2_01 | + momentum filter | $328 (32.8%) | $50 (5%) | 46%/72% | ❌ Overfits |
| 2 | iter2_02 | No trend filter | $439 (43.9%) | $258 (25.8%) | 37%/76% | ⚠️ Gap |
| 3 | iter2_03 | Lookback 60 | $439 (43.9%) | $524 (52.4%) | 76%/76% | ✅ WINNER |

## Key Insights

1. **iter2_03 (lookback 60) is the winner** - 52% on large, no overfitting
2. **Momentum filter hurt performance** - iter2_01 overfitted
3. **Wider lookback (60) improves results**

## Best Strategy: iter2_03 (lookback 60)

- Small: $439 (43.9%), 551 trades
- Large: $524 (52.4%), 10002 trades
- Win rate: ~76%
