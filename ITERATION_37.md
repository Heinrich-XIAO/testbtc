# ITERATION 37 - ATR Trail / Support-Age / Failed Breakout Fade

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter37_a` | ATR trailing stop variant | +32.74% | +19.95% | 37.5% / 36.8% | 403 / 7901 | ❌ Large < small |
| B | `strat_iter37_b` | Support-age weighted entry score | +11.78% | -2.78% | 32.6% / 35.3% | 785 / 12533 | ❌ Negative large |
| C | `strat_iter37_c` | Failed breakout fade with reclaim | -22.73% | -10.80% | 27.6% / 29.7% | 489 / 5014 | ❌ Negative both |

## Subagent Actions

- **`strat_iter37_a`**: Added ATR-multiple trailing stop anchored to post-entry peak while retaining hard-stop floor.
- **`strat_iter37_b`**: Added recency-weighted support-touch score using exponential age decay.
- **`strat_iter37_c`**: Added failed-breakdown detection window and reclaim-based fade entry.
- **Optimization workflow shared with all subagents**: DE optimization on `data/test-data.json`, persisted params, then validation-only backtest on `data/test-data-15min-large.json`.

## Hopeless / Discarded

- `strat_iter37_c`: negative performance on both datasets.
- `strat_iter37_b`: validation turned negative despite positive small-dataset result.
- `strat_iter37_a`: positive on both datasets but overfit under winner rule (large < small).

## Key Insights

1. ATR trailing exits remain viable but still underperform fixed-exit winners out-of-sample.
2. Support-age weighting adds complexity without improving generalization.
3. Failed-breakout fade is directionally plausible but unstable in this long-only implementation.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Best in this iteration (`strat_iter37_a` by validation return): +32.74% small, +19.95% large.
- **Winner:** None (no strategy met full winner criteria).
