# ITERATION 80

**Date**: 2026-02-25
**Phase**: Discovery - Statistical Inference Methods
**Strategies**: 5

## Strategy Summary Table

| Strategy | Small Return | Large Return | Trades (S/L) | Win Rate | Action | Notes |
|----------|-------------|--------------|--------------|----------|--------|-------|
| 80a | 0.00% | - | 0/- | 0% | DISCARD | Cointegration - no trades |
| 80b | 243.12% | 380.71% | 1370/23747 | 39.0%/41.4% | **WINNER** | Multi-lag Granger |
| 80c | 12.51% | - | 1185/- | 43.1% | KEEP | Cross-validation |
| 80d | 0.00% | - | 0/- | 0% | DISCARD | Bootstrap CI - no trades |
| 80e | 62.18% | 697.83% | 315/5716 | 39.0%/41.9% | **WINNER** | Permutation test |

## Key Insights

1. **Permutation Test (80e)** is amazing on large dataset - 62%/698%!
2. **Multi-lag Granger (80b)** also excellent - 243%/381%
3. Bootstrap and cointegration too restrictive

## Winners

1. **Strategy 80e** - Permutation Test
   - 62.18% (small) / 697.83% (large)
   - Much better on large dataset!

2. **Strategy 80b** - Multi-Lag Granger
   - 243.12% (small) / 380.71% (large)