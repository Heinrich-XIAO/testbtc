# ITERATION 43 - ATR Expansion / Divergence Proxy / Under-support Reclaim Duration

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter43_a` | ATR short/long expansion kickoff | +23.72% | +19.89% | 39.1% / 37.4% | 87 / 2219 | ❌ Large < small |
| B | `strat_iter43_b` | Bullish divergence proxy at support | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |
| C | `strat_iter43_c` | Reclaim after timed closes below support | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |

## Subagent Actions

- **`strat_iter43_a`**: Implemented volatility-regime transition entry using rising ATR-short/ATR-long ratio with support reversion trigger.
- **`strat_iter43_b`**: Implemented divergence proxy requiring fresh price low while stochastic low improves.
- **`strat_iter43_c`**: Implemented duration-aware reclaim logic after a bounded number of under-support closes.
- **Optimization workflow shared with all subagents**: optimize on `data/test-data.bson`, then validate frozen params on `data/test-data-15min-large.bson` using `--backtest-only`.

## Hopeless / Discarded

- `strat_iter43_b`: no-trade outcome on both datasets.
- `strat_iter43_c`: no-trade outcome on both datasets.
- `strat_iter43_a`: positive both datasets but fails anti-overfit rule (large < small).

## Key Insights

1. ATR expansion was directionally useful but not enough to beat overfit constraints.
2. Divergence and timed-under-support conditions were too strict for this data.
3. Support-reversion framework remains sensitive to added structural gates.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Best in this iteration (`strat_iter43_a` by large return): +23.72% small, +19.89% large.
- **Winner:** None (no strategy met full winner criteria).
