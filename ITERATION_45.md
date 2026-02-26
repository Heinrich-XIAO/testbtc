# ITERATION 45 - Choppiness Filter / Oversold Persistence Release / Shock Reversal Inside Bar

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter45_a` | Choppiness-gated support mean reversion | +9.17% | +39.00% | 34.6% / 34.2% | 26 / 911 | ✅ Winner |
| B | `strat_iter45_b` | Oversold persistence arm + release trigger | +20.23% | +31.84% | 40.0% / 40.1% | 325 / 4971 | ✅ Valid |
| C | `strat_iter45_c` | Shock-drop setup + inside-bar reversal | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |

## Subagent Actions

- **`strat_iter45_a`**: Implemented sign-change choppiness regime filter before support/stochastic reversion entry.
- **`strat_iter45_b`**: Implemented stateful oversold persistence arming with delayed stochastic release trigger.
- **`strat_iter45_c`**: Implemented shock-drop arming window followed by inside-bar bullish reversal confirmation.
- **Optimization workflow shared with all subagents**: optimize with DE on `data/test-data.json`, then backtest-only validation on `data/test-data-15min-large.json`.

## Hopeless / Discarded

- `strat_iter45_c`: no-trade behavior; setup stack too restrictive.

## Key Insights

1. Regime gating by choppiness materially improved large-dataset generalization.
2. Oversold persistence is robust, but choppiness gating had stronger validation edge.
3. Shock + inside-bar confirmation needs looser setup to avoid zero-trade collapse.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Iteration winner (`strat_iter45_a`): +9.17% small, +39.00% large.
- **Winner:** `strat_iter45_a` (meets all winner criteria and top large-dataset return in iteration).
