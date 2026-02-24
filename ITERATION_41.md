# ITERATION 41 - Compression Breakout / Sweep Reclaim / Distance-scaled Target

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter41_a` | Support-zone compression then breakout trigger | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |
| B | `strat_iter41_b` | Liquidity sweep below support then reclaim | +0.00% | +0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No trades |
| C | `strat_iter41_c` | Dynamic target from support-to-resistance distance | +30.94% | +34.49% | 38.6% / 37.7% | 83 / 1876 | ✅ Winner |

## Subagent Actions

- **`strat_iter41_a`**: Implemented volatility-compression entry near support with stochastic release and breakout confirmation.
- **`strat_iter41_b`**: Implemented wick-based liquidity sweep reclaim signal with stochastic recovery gate.
- **`strat_iter41_c`**: Implemented resistance-distance-scaled profit targeting with momentum-gated support entry.
- **Optimization workflow shared with all subagents**: differential-evolution optimization on `data/test-data.bson` writes `*.params.json`; then `--backtest-only` reuses frozen params on `data/test-data-15min-large.bson`.

## Hopeless / Discarded

- `strat_iter41_a`: no entries on either dataset.
- `strat_iter41_b`: no entries on either dataset.

## Key Insights

1. Sweep and compression variants were too selective and collapsed to zero-trade behavior.
2. Distance-aware take-profit logic preserved trade flow while improving validation robustness.
3. Dynamic exit sizing worked better than adding stricter entry structures in this round.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Iteration winner (`strat_iter41_c`): +30.94% small, +34.49% large.
- **Winner:** `strat_iter41_c` (meets full winner criteria and best large-dataset return in iteration).
