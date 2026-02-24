# ITERATION 48 - Percentile Shock Snapback / ATR Discount Reversion / Z-score Release Reversal

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter48_a` | Percentile shock arming then snapback entry | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |
| B | `strat_iter48_b` | ATR-normalized discount-from-mean support entry | +28.43% | +28.04% | 36.1% / 35.3% | 97 / 2001 | ❌ Overfit rule |
| C | `strat_iter48_c` | Z-score deep-discount then release crossover | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |

## Subagent Actions

- **`strat_iter48_a`**: Implemented shock-percentile arm window followed by rebound confirmation entry.
- **`strat_iter48_b`**: Implemented ATR-normalized discount gate around rolling mean with support/stochastic reclaim.
- **`strat_iter48_c`**: Implemented z-score deep entry with release threshold crossover.
- **Optimization workflow shared with all subagents**: DE optimization on `data/test-data.bson`, then backtest-only validation on `data/test-data-15min-large.bson`.

## Hopeless / Discarded

- `strat_iter48_a`: no entries after optimization; shock arm/rebound sequence too restrictive.
- `strat_iter48_c`: no entries; z-score release thresholds did not trigger robustly.

## Key Insights

1. ATR-normalized discount logic is viable but slightly overfit by current winner rule (large < small).
2. Two-stage arming setups (shock and z-release) are too sparse on current datasets.
3. This round produced no strategy satisfying full winner criteria.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Best candidate in this iteration (`strat_iter48_b`): +28.43% small, +28.04% large.
- **Winner call:** No qualified winner (best candidate fails large >= small rule).
