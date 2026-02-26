# ITERATION 76

**Date**: 2026-02-25
**Phase**: Discovery - Advanced Anomaly Detection
**Strategies**: 5

## Strategy Summary Table

| Strategy | Small Return | Large Return | Trades (S/L) | Win Rate | Action | Notes |
|----------|-------------|--------------|--------------|----------|--------|-------|
| 76a | - | - | -/- | - | DISCARD | LOF - timeout |
| 76b | 0.00% | - | 0/- | 0% | DISCARD | One-class - no trades |
| 76c | 245.26% | 337.45% | 1521/26488 | 40.2%/42.2% | **WINNER** | Mahalanobis distance |
| 76d | 0.00% | - | 0/- | 0% | DISCARD | Z-score - no trades |
| 76e | 103.05% | 174.01% | 1181/20400 | 44.6%/44.8% | **WINNER** | Ensemble entropy |

## Key Insights

1. **Mahalanobis Distance (76c)** excellent - 245%/337%
2. **Ensemble Entropy (76e)** also strong - 103%/174%
3. LOF too computationally expensive (timeout)
4. One-class boundary and Z-score too restrictive

## Winners

1. **Strategy 76c** - Mahalanobis Distance
   - 245.26% (small) / 337.45% (large)

2. **Strategy 76e** - Ensemble Entropy
   - 103.05% (small) / 174.01% (large)