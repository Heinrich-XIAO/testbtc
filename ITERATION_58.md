# ITERATION 58 - Recurrence / Bayesian Ensemble / Fractal Alignment

**Date:** 2026-02-24
**Phase:** Phase 5 - Crazy Exploration
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter58_a` | RQA-like recurrence transition | +43.16% | -26.29% | 33.3% / 30.2% | 12 / 242 | ❌ Negative large |
| B | `strat_iter58_b` | Bayesian model-averaged mini-ensemble | +170.40% | +154.75% | 41.0% / 40.3% | 305 / 3976 | ⚠️ Large < small |
| C | `strat_iter58_c` | Multi-horizon fractal alignment | +22.86% | +17.24% | 33.3% / 32.0% | 81 / 1036 | ⚠️ Large < small |

## Key Insights

1. Bayesian adaptive ensembles remain strong but still show slight small-set skew.
2. Recurrence-transition setups were unstable and failed out-of-sample here.
3. Fractal alignment logic is viable but not yet robust enough to beat the large>=small constraint.
