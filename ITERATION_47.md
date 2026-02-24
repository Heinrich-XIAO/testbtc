# ITERATION 47 - EMA Inflection / Stochastic Velocity Burst / Support Dwell Breakout

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter47_a` | EMA slope inflection reclaim near support | +16.81% | -2.47% | 42.9% / 37.1% | 91 / 1746 | ❌ Negative validation |
| B | `strat_iter47_b` | Stochastic velocity-burst entry at support | +17.19% | +28.74% | 40.8% / 39.4% | 341 / 6156 | ✅ Winner |
| C | `strat_iter47_c` | Support dwell compression then local breakout | +108.13% | +11.27% | 38.2% / 37.1% | 403 / 6402 | ❌ Overfit rule |

## Subagent Actions

- **`strat_iter47_a`**: Implemented EMA slope sign-flip entry confirmation on top of support/stochastic setup.
- **`strat_iter47_b`**: Implemented stochastic velocity burst gate (delta-K acceleration) for entry quality.
- **`strat_iter47_c`**: Implemented support-dwell accumulation then breakout trigger logic.
- **Optimization workflow shared with all subagents**: DE optimization on `data/test-data.bson`, then backtest-only validation on `data/test-data-15min-large.bson`.

## Hopeless / Discarded

- `strat_iter47_a`: validation turned negative despite positive small result.

## Key Insights

1. Stochastic velocity burst produced robust cross-dataset behavior and met all winner rules.
2. Dwell-breakout architecture generates high small returns but clear overfit signature.
3. EMA inflection alone is not a sufficient guard against large-dataset decay.

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Iteration winner (`strat_iter47_b`): +17.19% small, +28.74% large.
- **Winner call:** `strat_iter47_b` (meets all winner criteria and leads qualified set).
