# ITERATION 72

**Date**: 2026-02-25
**Phase**: Discovery - Chaos & Complexity Theory
**Strategies**: 5

## Strategy Summary Table

| Strategy | Small Return | Large Return | Trades (S/L) | Win Rate | Action | Notes |
|----------|-------------|--------------|--------------|----------|--------|-------|
| 72a | 13.71% | - | 354/- | 39.3% | KEEP | Sample entropy |
| 72b | 13.25% | - | 364/- | 39.8% | KEEP | Multiscale entropy |
| 72c | -0.25% | - | 332/- | 40.7% | DISCARD | LZ complexity - negative |
| 72d | 220.60% | 538.93% | 406/3800 | 28.8%/30.2% | **WINNER** | Takens NN - BEST! |
| 72e | 5.13% | - | 2/- | 50.0% | DISCARD | Lyapunov - too few trades |

## Key Insights

1. **Takens Nearest Neighbor (72d)** is a major winner - 220%/538%!
2. Sample entropy and multiscale entropy underperform vs ApEn from iter 71
3. LZ complexity doesn't work well for trading
4. Lyapunov exponent too restrictive (only 2 trades)

## Winner

**Strategy 72d** - Takens Nearest Neighbor
- 220.60% (small) / 538.93% (large)
- Uses phase space reconstruction to find similar historical states
- Enters when past similar states led to price increases