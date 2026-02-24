# ITERATION 38 - RSI Percentile / Donchian Hybrid / Two-Stage Entry

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter38_a` | RSI percentile regime entry | +462.75% | +247.38% | 39.8% / 41.3% | 1283 / 19356 | ❌ Large < small |
| B | `strat_iter38_b` | Donchian mean-revert hybrid | +390.44% | +156.62% | 41.3% / 43.1% | 2562 / 37999 | ❌ Large < small |
| C | `strat_iter38_c` | Two-stage entry confirmation | +48.71% | -7.05% | 39.1% / 32.7% | 115 / 1860 | ❌ Negative large |

## Subagent Actions

- **`strat_iter38_a`**: Implemented rolling RSI percentile regime detection and support-gated entries.
- **`strat_iter38_b`**: Implemented Donchian lower-band mean-revert entries with channel-aware exits.
- **`strat_iter38_c`**: Implemented staged signal flow (setup then breakout confirmation within a finite window).
- **Optimization workflow shared with all subagents**: DE optimization on small dataset followed by frozen-parameter large backtest (`--backtest-only`).

## Hopeless / Discarded

- `strat_iter38_c`: validation performance turned negative.
- `strat_iter38_a`: massive small-sample gains but fails anti-overfit criterion.
- `strat_iter38_b`: same overfit pattern as A despite strong absolute validation return.

## Key Insights

1. Regime/range hybrids can generate very high in-sample returns but frequently violate large>=small validation rule.
2. Very high trade counts did not guarantee better out-of-sample scaling.
3. Two-stage confirmation reduced false positives but still failed robustness tests here.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Best in this iteration (`strat_iter38_a` by validation return): +462.75% small, +247.38% large.
- **Winner:** None (no strategy met full winner criteria).
