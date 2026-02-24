# ITERATION 49 - Loss Cluster HL / Distance-scaled Target v2 / Dual Support Alignment

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter49_a` | Loss-cluster exhaustion with higher-low confirmation | +10.43% | +6.17% | 43.8% / 34.4% | 16 / 334 | ❌ Overfit rule |
| B | `strat_iter49_b` | Dynamic target scaled to resistance distance | +25.75% | +39.99% | 41.3% / 39.5% | 344 / 6571 | ✅ Winner |
| C | `strat_iter49_c` | Dual support alignment across short/long lookbacks | +27.37% | +38.22% | 40.5% / 38.7% | 343 / 6748 | ✅ Valid |

## Subagent Actions

- **`strat_iter49_a`**: Implemented downside cluster detection followed by higher-low reversal trigger.
- **`strat_iter49_b`**: Implemented resistance-distance-scaled take-profit bounds with baseline support/stochastic entry.
- **`strat_iter49_c`**: Implemented dual-horizon support agreement gate before entry.
- **Optimization workflow shared with all subagents**: DE optimization on `data/test-data.bson`, then backtest-only validation on `data/test-data-15min-large.bson`.

## Hopeless / Discarded

- None fully hopeless this round; all three produced trades and positive large returns.

## Key Insights

1. Distance-scaled targeting remains the strongest logic family for robust validation returns.
2. Dual support alignment is robust and close to winner performance.
3. Loss-cluster reversal is viable but less stable under large >= small criterion.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Iteration winner (`strat_iter49_b`): +25.75% small, +39.99% large.
- **Winner call:** `strat_iter49_b` (highest large return among qualified strategies).
