# ITERATION 60 - SAX / Kalman Residual / Counterfactual Utility

**Date:** 2026-02-24
**Phase:** Phase 5 - Crazy Exploration
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter60_a` | SAX motif dictionary matching | +39.20% | +37.56% | 43.4% / 42.9% | 348 / 9873 | ⚠️ Large < small |
| B | `strat_iter60_b` | Kalman-like residual rebound gate | +62.69% | +69.41% | 50.0% / 36.5% | 26 / 301 | ✅ Winner |
| C | `strat_iter60_c` | Counterfactual scenario utility ensemble | +89.87% | +345.57% | 40.9% / 35.8% | 44 / 455 | ✅ Winner |

## Key Insights

1. Counterfactual expected-utility scoring (C) produced the strongest large-dataset edge in this round.
2. Kalman-style residual gating (B) generalized well despite lower signal count.
3. Symbolic motif matching (A) remains effective but still slightly biased toward small data.
