# ITERATION 56 - Persistence / Markov / Wavelet Energy

**Date:** 2026-02-24
**Phase:** Phase 5 - Crazy Exploration
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter56_a` | Topological persistence proxy | +5.62% | +0.43% | 50.0% / 37.4% | 8 / 444 | ❌ <15 small trades |
| B | `strat_iter56_b` | Online 2-state Markov posterior | +65.79% | -6.07% | 35.2% / 32.5% | 508 / 9784 | ❌ Negative large |
| C | `strat_iter56_c` | Wavelet-like energy ratio filter | +40.94% | +31.97% | 36.8% / 27.1% | 38 / 350 | ⚠️ Large < small |

## Key Insights

1. Hidden-state posterior logic can produce strong in-sample gains but degraded badly out-of-sample in this run.
2. Multi-scale energy filters are viable but currently biased toward small-set performance.
3. Persistence-style entries need higher signal frequency to qualify under trade-count constraints.
