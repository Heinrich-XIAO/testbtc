# ITERATION 163

**Date**: 2026-02-26
**Number of Strategies**: 5

## Summary

No winners. 163b showed promise on small (26.61%) but failed on large (18.78%), indicating overfitting.

## Strategy Results

| Strategy | Logic | Small Return | Large Return | Trades (Small) | Status |
|----------|-------|--------------|--------------|----------------|--------|
| 163a | BB + Stochastic near support | 0.51% | 1.32% | 24 | Weak |
| 163b | RSI + MA cross near support | 26.61% | 18.78% | 556 | Overfit |
| 163c | Momentum + Volume spike | 0.00% | - | 0 | Failed |
| 163d | Stochastic slope + MA | 0.00% | - | 0 | Failed |
| 163e | ATR volatility breakout | 2.58% | -4.58% | 259 | Negative |

## Key Insights

- 163b: Overfitting detected (large < small)
- Volume-based strategies (163c) fail due to missing volume data in dataset
- Stochastic slope strategy (163d) too restrictive

## Hopeless Strategies

- 163c: No volume data available in dataset
- 163d: Slope-based entry too strict, no trades triggered
