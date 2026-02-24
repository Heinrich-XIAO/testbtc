# ITERATION 44 - Range Regime Hybrid / Loss-streak Cooldown / Half-life Stop Tightening

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter44_a` | Regime switch: low-range mean-revert vs high-range breakout | +61.26% | +35.32% | 38.3% / 38.0% | 389 / 7207 | ❌ Large < small |
| B | `strat_iter44_b` | Adaptive cooldown from per-token loss streak | +23.25% | +25.42% | 39.8% / 38.9% | 387 / 7371 | ✅ Valid |
| C | `strat_iter44_c` | Time-decaying half-life stop distance | +17.73% | +32.75% | 39.4% / 38.4% | 371 / 7198 | ✅ Winner |

## Subagent Actions

- **`strat_iter44_a`**: Implemented dual entry branch selected by normalized range regime.
- **`strat_iter44_b`**: Implemented cooldown duration that increases after consecutive stop-loss events and resets after non-stop exits.
- **`strat_iter44_c`**: Implemented exponential stop tightening with floor stop to control long-hold risk.
- **Optimization workflow shared with all subagents**: optimize on small dataset, persist params, then run large-dataset `--backtest-only` validation.

## Hopeless / Discarded

- `strat_iter44_a`: overfit by winner rule despite strong absolute validation return.

## Key Insights

1. Exit adaptation (half-life stop) generalized better than regime-branching entry complexity.
2. Loss-streak cooldown improved robustness and kept large >= small.
3. High-trade-count strategies can still pass validation if exit logic remains simple and adaptive.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Iteration winner (`strat_iter44_c`): +17.73% small, +32.75% large.
- **Winner:** `strat_iter44_c` (meets all criteria and highest large-dataset return among valid strategies).
