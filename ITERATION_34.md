# ITERATION 34 - Breakout / Z-Score / Exhaustion

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter34_a` | Donchian breakout + retest reclaim | +148.23% | +51.21% | 39.3% / 39.4% | 300 / 3747 | ⚠️ Large < small |
| B | `strat_iter34_b` | Z-score mean-reversion entry + mean-target exit | +389.73% | +303.80% | 29.6% / 32.3% | 700 / 9229 | ⚠️ Strong but overfit signal |
| C | `strat_iter34_c` | ROC deceleration exhaustion exit | +41.21% | +66.62% | 32.0% / 29.9% | 97 / 1366 | ✅ Winner |

## Subagent Actions

- **`strat_iter34_a`**: Introduced breakout-state tracking and mandatory pullback retest before entry. This is a clear logic shift from support-touch entries.
- **`strat_iter34_b`**: Added rolling z-score trigger and explicit mean-reversion target exits, replacing stochastic-first entry logic.
- **`strat_iter34_c`**: Kept baseline stochastic support entry but added a new early exit path when ROC momentum decelerates sharply post-entry.

## Hopeless / Discarded

- None fully discarded yet, but `strat_iter34_a` and `strat_iter34_b` show strong in-sample skew (large < small), so they are not promoted as robust winners.

## Key Insights

1. Z-score and breakout/retest logics can produce very high absolute returns, but both currently show overfit signatures.
2. Momentum-exhaustion exits (ROC delta) are a useful additive control that improved large-dataset generalization.
3. High-return novelty should still be filtered by robustness, not raw percentage alone.

## Comparison to Best Known Strategy

- `iter33_a`: +54.15% small, +129.96% large.
- `iter34_c`: +41.21% small, +66.62% large (valid, but not better than current best large-dataset leader).
