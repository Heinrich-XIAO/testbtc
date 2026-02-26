# ITERATION 40 - Confirmation Score / MACD Retest / Range-Normalized Momentum

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter40_a` | Multi-bar confirmation score | +22.20% | +0.25% | 40.2% / 37.2% | 112 / 2321 | ❌ Large < small |
| B | `strat_iter40_b` | MACD zero-line retest | +1.42% | -12.99% | 38.4% / 39.4% | 146 / 3322 | ❌ Negative large |
| C | `strat_iter40_c` | Range-normalized momentum | +19.61% | +12.35% | 38.7% / 36.9% | 119 / 3006 | ❌ Large < small |

## Subagent Actions

- **`strat_iter40_a`**: Implemented additive multi-bar confirmation scoring (support, stochastic, momentum, candle strength).
- **`strat_iter40_b`**: Implemented MACD zero-line retest trigger with support filter and signal-line defensive exit.
- **`strat_iter40_c`**: Implemented momentum normalized by rolling range to avoid scale bias across tokens.
- **Optimization workflow shared with all subagents**: optimize on `data/test-data.json`, then freeze params and validate on `data/test-data-15min-large.json`.

## Hopeless / Discarded

- `strat_iter40_b`: validation turned negative.
- `strat_iter40_a`: validation nearly flat despite positive small-dataset returns.
- `strat_iter40_c`: remains positive but fails anti-overfit rule (large < small).

## Key Insights

1. Additional confirmation scoring did not translate into stronger validation edge.
2. MACD retest logic underperformed in this support-reversion framework.
3. Range-normalized momentum was directionally useful but still overfit relative to winner criteria.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Best in this iteration (`strat_iter40_c` by validation return): +19.61% small, +12.35% large.
- **Winner:** None (no strategy met full winner criteria).
