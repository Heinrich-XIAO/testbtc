# ITERATION 74

**Date**: 2026-02-25
**Phase**: Discovery - Distribution Divergence Measures
**Strategies**: 5

## Strategy Summary Table

| Strategy | Small Return | Large Return | Trades (S/L) | Win Rate | Action | Notes |
|----------|-------------|--------------|--------------|----------|--------|-------|
| 74a | 194.80% | 308.97% | 1491/25762 | 40.4%/42.3% | **WINNER** | KL Divergence |
| 74b | 86.40% | 294.24% | 586/10487 | 42.8%/44.7% | **WINNER** | JS Divergence |
| 74c | 35.01% | - | 144/- | 37.5% | KEEP | Hellinger distance |
| 74d | 134.48% | 378.19% | 1086/17150 | 37.5%/41.1% | **WINNER** | Bhattacharyya |
| 74e | 42.49% | - | 1156/- | 44.5% | KEEP | Wasserstein distance |

## Key Insights

1. **KL Divergence (74a)** excellent - 194%/308%
2. **Bhattacharyya (74d)** best on large - 134%/378%
3. **JS Divergence (74b)** also strong - 86%/294%
4. Distribution divergence measures work well for regime detection

## Winners

1. **Strategy 74d** - Bhattacharyya Distance
   - 134.48% (small) / 378.19% (large)

2. **Strategy 74a** - KL Divergence
   - 194.80% (small) / 308.97% (large)

3. **Strategy 74b** - JS Divergence
   - 86.40% (small) / 294.24% (large)