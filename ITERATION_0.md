# ITERATION 0 - Baseline Stochastic Strategies

**Date:** 2026-02-22
**Phase:** Phase 1 - Baseline & Discovery
**Number of Strategies:** 3

## Summary

Established baseline with simple stochastic strategies. All strategies returned negative results, indicating the need for improved entry/exit logic.

## Strategy Summary Table

| # | Strategy | Logic | Return | Win Rate | Trades | Status |
|---|----------|-------|--------|----------|--------|--------|
| 1 | stoch_baseline_01 | Simple stoch oversold cross | -$225.24 | 48.3% | 1248 | ❌ Negative |
| 2 | stoch_baseline_02 | Tight stoch (14) + K/D cross | -$397.43 | 45.6% | 1213 | ❌ Negative |
| 3 | stoch_baseline_03 | Stoch + momentum filter | -$374.36 | 62.9% | 639 | ❌ Negative |

## Key Insights

1. **All baseline strategies lost money** - Simple stochastic crossover alone is not sufficient
2. **Strategy 03 had highest win rate (62.9%)** - Momentum filter improved quality but still negative
3. **Too many trades (1200+)** - Strategies are entering too frequently on noise
4. **Tight stoch (14) performed worst** - May be too restrictive without other filters

## Discarded Strategies

All 3 strategies failed to achieve positive returns. None are suitable as a winner.

## Next Iteration Ideas

1. Add support/resistance confirmation to entries
2. Reduce trade frequency with additional entry conditions
3. Test wider stop loss / profit target ratios
4. Add retest requirement for support levels
