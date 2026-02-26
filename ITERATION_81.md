# ITERATION 81

**Date**: 2026-02-25
**Phase**: Discovery - State-Space Models
**Strategies**: 5

## Strategy Summary Table

| Strategy | Small Return | Large Return | Trades (S/L) | Win Rate | Action | Notes |
|----------|-------------|--------------|--------------|----------|--------|-------|
| 81a | 0.00% | - | 0/- | 0% | DISCARD | Kalman filter - no trades |
| 81b | 180.36% | 623.06% | 100/820 | 28.0%/25.7% | **WINNER** | Particle filter |
| 81c | 47.25% | - | 721/- | 42.0% | KEEP | HMM |
| 81d | 303.22% | 276.61% | 1527/26105 | 40.5%/42.4% | **WINNER** | EM mixture |
| 81e | 21.62% | - | 8/- | 37.5% | DISCARD | Online learning - few trades |

## Key Insights

1. **EM Mixture Model (81d)** excellent - 303%/277%
2. **Particle Filter (81b)** amazing on large - 180%/623%
3. Kalman filter too restrictive
4. Mixture models and particle filters work well

## Winners

1. **Strategy 81d** - EM Mixture Model
   - 303.22% (small) / 276.61% (large)

2. **Strategy 81b** - Particle Filter
   - 180.36% (small) / 623.06% (large)