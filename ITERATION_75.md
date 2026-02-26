# ITERATION 75

**Date**: 2026-02-25
**Phase**: Discovery - Machine Learning Anomaly Detection
**Strategies**: 5

## Strategy Summary Table

| Strategy | Small Return | Large Return | Trades (S/L) | Win Rate | Action | Notes |
|----------|-------------|--------------|--------------|----------|--------|-------|
| 75a | 0.00% | - | 0/- | 0% | DISCARD | Autoencoder - no trades |
| 75b | 1.32% | - | 4/- | 50.0% | DISCARD | PCA - too few trades |
| 75c | 8.95% | - | 108/- | 45.4% | KEEP | K-means clustering |
| 75d | -1.62% | - | 2/- | 0.0% | DISCARD | Density - negative |
| 75e | 236.99% | - | 1565/- | 39.7% | **WINNER** | Isolation score |

## Key Insights

1. **Isolation Forest (75e)** shows excellent results - 237%!
2. Other ML approaches (autoencoder, PCA) didn't generate enough trades
3. Density-based clustering too restrictive

## Winner

**Strategy 75e** - Isolation Score
- 236.99% return, 1565 trades on small dataset
- Large dataset validation timed out