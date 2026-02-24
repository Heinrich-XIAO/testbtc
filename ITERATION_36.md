# ITERATION 36 - VWAP Re-entry / EMA Slope Gate / Stoch Hysteresis

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter36_a` | VWAP deviation re-entry after reclaim | +5.27% | +3.05% | 37.5% / 35.6% | 8 / 160 | ❌ Too few small trades + large < small |
| B | `strat_iter36_b` | EMA slope regime gate on entry | +0.00% | +1.06% | 50.0% / 38.1% | 4 / 118 | ❌ Too few small trades |
| C | `strat_iter36_c` | Stochastic hysteresis arming/trigger bands | +6.67% | +2.96% | 45.2% / 42.1% | 352 / 6589 | ❌ Large < small |

## Subagent Actions

- **`strat_iter36_a`**: Implemented VWAP deviation-and-reclaim entry combined with support proximity and stochastic recovery.
- **`strat_iter36_b`**: Implemented EMA slope regime gate (bounded slope window) before allowing oversold support entries.
- **`strat_iter36_c`**: Implemented hysteresis state machine (`arm_band` -> `trigger_band` -> `disarm_band`) to reduce noisy stochastic triggers.
- **Optimization workflow shared with all subagents**: `run-optimization` uses DE random-search + evolution on `data/test-data.bson`, writes params JSON, then `--backtest-only` validates on `data/test-data-15min-large.bson` with frozen params.

## Hopeless / Discarded

- `strat_iter36_b`: only 4 small-dataset trades; fails minimum significance.
- `strat_iter36_a`: only 8 small-dataset trades; fails minimum significance.
- `strat_iter36_c`: statistically active but validation return drops vs small dataset.

## Key Insights

1. VWAP-reclaim style logic can be robust but was too selective under this parameterization.
2. EMA slope gating reduced opportunities too aggressively for this market structure.
3. Stochastic hysteresis improved signal quality but did not improve out-of-sample scaling.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Best in this iteration (`strat_iter36_c` by validation return among active variants): +6.67% small, +2.96% large.
- **Winner:** None (no strategy met full winner criteria).
