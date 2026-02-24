# ITERATION 31 - Novel Entry Filters

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Summary

| # | Strategy | Logic | Small Result | Large Result | Status |
|---|----------|-------|--------------|--------------|--------|
| A | `strat_iter31_a` | MACD crossover + support proximity | $219.86 (21.99%) | $465.39 (46.54%) | ✅ Positive (no overfitting) |
| B | `strat_iter31_b` | Bollinger + stochastic confirmation | $201.16 (20.12%) | $643.16 (64.32%) | ✅ **Winner** |
| C | `strat_iter31_c` | Mean reversion (2σ below MA + RSI <30) | $4,429.75 (442.98%) | $2,501.49 (250.15%) | ⚠️ Large dataset < small dataset |

## Subagent Actions

- **MACD entry (`strat_iter31_a`)** – Added 12/26/9 MACD with support proximity checks; optimizer tuned stop (~6.3%), profit (~18.7%), risk (~29.3%), support threshold (~0.69%). Backtests: +21.99% small, +46.54% large.
- **Bollinger entry (`strat_iter31_b`)** – Lower Bollinger band touch plus stochastic crossover using the 20/2 bands; optimizer selected K=16, D=5, oversold=22, stop ≈7.45%, profit ≈19.7%. Backtests: +20.12% small, +64.32% large.
- **Mean reversion (`strat_iter31_c`)** – Buy when price is 2 std dev below 20-period MA and RSI<30; exits at stop/profit/MA. Optimizer stored tuned params, but the small dataset return spikes while the large dataset is smaller, so it fails the overfitting guard.

## Hopeless / Discarded

- `strat_iter31_c` – Large dataset return trails the small dataset despite large absolute gains, so the logic is still overfitting the training data.

## Key Insights

1. Bollinger-based entries can outperform MACD while remaining novel; they drove the strongest large-dataset gain in this iteration.
2. Novel logic that changes the indicator (MACD, Bollinger, mean reversion) must still satisfy the large ≥ small filter before being promoted.
3. The updated protocol (parallel subagents, optimization handling) survived a busy iteration with no manual parameter re-runs.

## Comparison to Best Known Strategy

- **iter20_a** (lookback 51, max hold 32): $125.34 small, $942.90 large
- **iter31_b** (Bollinger entry): $201.16 small, $643.16 large – better small-dataset edge but still below the all-time large return, highlighting the need for further validation.

## Notes

- Iteration 31 strictly followed the new guideline: three novel logics ideated simultaneously and tuned via the optimization script. Each strategy deserves further validation before promotion due to the new indicator mix.
