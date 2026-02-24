# ITERATION 39 - Time-Decay TP / Dynamic Resistance / Stopout Cooldown

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter39_a` | Time-decay profit target | +20.74% | +44.33% | 42.2% / 39.2% | 351 / 6850 | ✅ Valid |
| B | `strat_iter39_b` | Dynamic resistance threshold by volatility | +35.94% | +46.19% | 40.7% / 39.0% | 334 / 6104 | ✅ Winner |
| C | `strat_iter39_c` | Position cooldown after stopout | +19.44% | +33.58% | 41.0% / 39.0% | 363 / 7109 | ✅ Valid |

## Subagent Actions

- **`strat_iter39_a`**: Added bar-by-bar decay schedule for profit target from initial target down to floor.
- **`strat_iter39_b`**: Added volatility-normalized dynamic resistance exit threshold to adapt exit aggressiveness.
- **`strat_iter39_c`**: Added per-token cooldown lockout after stop-loss events to suppress immediate re-entries.
- **Optimization workflow shared with all subagents**: DE optimize on `data/test-data.bson`, persist params, then validate with `--backtest-only` on `data/test-data-15min-large.bson`.

## Hopeless / Discarded

- None. All three passed winner validity checks; only lower-ranked by validation return.

## Key Insights

1. Exit-logic adaptation produced the best robustness of iterations 36-40.
2. Volatility-adjusted resistance exits improved cross-dataset consistency and top-line return.
3. Stopout cooldown improved stability but lagged adaptive-resistance returns.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- New iteration winner (`strat_iter39_b`): +35.94% small, +46.19% large.
- **Winner:** `strat_iter39_b` (meets all criteria and highest large-dataset return in iteration).
