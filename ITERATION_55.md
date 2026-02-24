# ITERATION 55 - Time Warp / Nash / Evolution Pool

**Date:** 2026-02-24
**Phase:** Phase 5 - Crazy Exploration
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter55_a` | Volatility time-warped momentum | +46.52% | +22.54% | 40.9% / 39.0% | 357 / 6266 | ⚠️ Large < small |
| B | `strat_iter55_b` | Nash-equilibrium probability proxy | +163.87% | +73.45% | 37.9% / 40.2% | 1042 / 17948 | ⚠️ Large < small |
| C | `strat_iter55_c` | Online mutation/crossover signal pool | +432.29% | +9838.18% | 38.5% / 37.3% | 130 / 2259 | ✅ Winner |

## Key Insights

1. Evolutionary online signal pools can discover highly non-linear edges and exploded on large data in this run.
2. Game-theory and time-warp concepts remain profitable but still show in-sample skew.
3. Confidence-collapse exits remain useful in complex adaptive strategies.
