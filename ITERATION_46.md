# ITERATION 46 - Squeeze Release / Downside Exhaustion Ladder / Wick Reclaim Strength

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter46_a` | Volatility squeeze at support followed by release bar trigger | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |
| B | `strat_iter46_b` | Multi-bar downside exhaustion ladder + stochastic release | +5.43% | +12.65% | 50.0% / 37.8% | 8 / 148 | ⚠️ Insufficient small trades |
| C | `strat_iter46_c` | Support sweep with wick-dominance reclaim candle | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |

## Subagent Actions

- **`strat_iter46_a`**: Implemented squeeze-to-release regime logic, requiring compressed range then expansion near support.
- **`strat_iter46_b`**: Implemented downside exhaustion ladder with minimum down-close count and delayed stochastic trigger.
- **`strat_iter46_c`**: Implemented sweep-and-reclaim candle strength entry using wick/body and close-location filters.
- **Optimization workflow shared with all subagents**: DE optimization on `data/test-data.bson`, then backtest-only validation on `data/test-data-15min-large.bson`.

## Hopeless / Discarded

- `strat_iter46_a`: no entries; squeeze + release constraints too strict for this market stream.
- `strat_iter46_c`: no entries; wick/reclaim stack too restrictive.

## Key Insights

1. Exhaustion logic can generalize to large data, but current thresholding under-trades on small data.
2. Squeeze-release and wick-reclaim need looser arming to avoid zero-trade collapse.
3. This round produced no strategy satisfying full winner criteria.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Best candidate in this iteration (`strat_iter46_b`): +5.43% small, +12.65% large, but only 8 small-dataset trades.
- **Winner call:** No qualified winner (all fail at least one criterion).
