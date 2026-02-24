# ITERATION 52 - Fractal / Superposition / Swarm

**Date:** 2026-02-24
**Phase:** Phase 5 - Crazy Exploration
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter52_a` | Hurst exponent regime gate + stoch/support | +510.0% | +278.2% | 38.0% / 40.3% | 1249 / 20596 | ⚠️ Large < small |
| B | `strat_iter52_b` | Multi-timeframe stochastic "quantum collapse" | +742.4% | +662.1% | 41.5% / 43.1% | 1209 / 18855 | ✅ Winner |
| C | `strat_iter52_c` | MA swarm centroid/spread convergence | +124.9% | +185.2% | 39.2% / 41.3% | 2041 / 35195 | ✅ Winner |

## Key Insights

1. Multi-timeframe agreement logic (B) remains highly effective and scales cleanly to large data.
2. Swarm-convergence entries (C) produce robust large-dataset generalization with high sample size.
3. Fractal-regime filters can still overfit in high-return scenarios when small outpaces large.
