# ITERATION 42 - Rising Support / Z-Score Holds / EMA Pullback Continuation

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter42_a` | Rising support staircase filter | +3.01% | +21.06% | 25.0% / 39.5% | 20 / 854 | ✅ Winner |
| B | `strat_iter42_b` | Z-score pullback + support hold count | +70.46% | +27.46% | 28.4% / 31.5% | 225 / 3829 | ❌ Large < small |
| C | `strat_iter42_c` | Breakout then EMA pullback continuation | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |

## Subagent Actions

- **`strat_iter42_a`**: Implemented dual-horizon support comparison to require support levels stepping higher before entry.
- **`strat_iter42_b`**: Implemented mean-reversion z-score entry with explicit count of recent support holds.
- **`strat_iter42_c`**: Implemented breakout-state plus pullback-to-EMA continuation trigger with stochastic release.
- **Optimization workflow shared with all subagents**: optimize on `data/test-data.bson`, persist params, then large-dataset validation via `--backtest-only`.

## Hopeless / Discarded

- `strat_iter42_c`: zero-trade behavior on both datasets.
- `strat_iter42_b`: strong small set but overfit relative to large-dataset rule.

## Key Insights

1. Structural support-lift filtering generalized better than pure deep-mean-reversion z-score entries.
2. Hold-count reversion can inflate small returns but overfit against large validation.
3. EMA pullback continuation remained too restrictive in this market regime.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Iteration winner (`strat_iter42_a`): +3.01% small, +21.06% large.
- **Winner:** `strat_iter42_a` (only strategy meeting all winner criteria in iteration).
