# ITERATION 50 - Under-support Reclaim v2 / Narrow Range Impulse / Pressure Flip Reversal

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter50_a` | Under-support dwell then reclaim trigger v2 | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |
| B | `strat_iter50_b` | Narrow-range compression + impulse candle entry | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |
| C | `strat_iter50_c` | Open-close pressure flip reversal near support | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |

## Subagent Actions

- **`strat_iter50_a`**: Implemented bounded under-support duration + reclaim + stoch recovery entry.
- **`strat_iter50_b`**: Implemented narrow-range regime filter with body-strength impulse trigger.
- **`strat_iter50_c`**: Implemented pressure-flip reversal using candle pressure transition and stochastic recovery.
- **Optimization workflow shared with all subagents**: DE optimization on `data/test-data.json`, then backtest-only validation on `data/test-data-15min-large.json`.

## Hopeless / Discarded

- `strat_iter50_a`: no entries across both datasets.
- `strat_iter50_b`: no entries across both datasets.
- `strat_iter50_c`: no entries across both datasets.

## Key Insights

1. This design set is materially too restrictive for available market microstructure.
2. Compression-plus-impulse and pressure-flip gates need looser thresholds or alternate arming states.
3. This round produced no strategy satisfying winner criteria.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Best candidate in this iteration: none (all strategies produced zero trades).
- **Winner call:** No qualified winner.
