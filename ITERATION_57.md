# ITERATION 57 - MI / Capitulation / Adaptive Risk-Parity

**Date:** 2026-02-24
**Phase:** Phase 5 - Crazy Exploration
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter57_a` | Mutual-information predictability spike | +8.90% | +12.03% | 33.3% / 30.6% | 6 / 72 | ❌ <15 small trades |
| B | `strat_iter57_b` | Behavioral capitulation + stabilization | 0.00% | 0.00% | 0% / 0% | 0 / 0 | ❌ No signal |
| C | `strat_iter57_c` | Vol+drawdown adaptive risk-parity sizing | +22.82% | +20.47% | 39.6% / 38.6% | 371 / 6518 | ⚠️ Large < small |

## Key Insights

1. MI-based predictability spikes can work but currently generate too few small-dataset trades.
2. Capitulation logic was too strict and produced zero signal frequency.
3. Adaptive risk sizing stabilized behavior but did not improve out-of-sample relative return in this run.
