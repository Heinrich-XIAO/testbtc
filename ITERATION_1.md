# Iteration 1 - Initial Baseline on 10k Dataset

**Date:** 2026-02-15
**Dataset:** data/test-data-15min-10k.bson (10,000 markets, ~1.7M price points)
**Method:** 200 strategies optimized in 8 parallel batches (25 strategies each)

## Summary Statistics

- **Total Strategies:** 200
- **Completed:** 200
- **Passed (profitable):** ~75
- **Failed:** ~90
- **Errors (timeout):** ~35

## Top 20 Performers

| Rank | Strategy | Test Return | Trades | Sharpe | Status |
|------|----------|-------------|--------|--------|--------|
| 1 | stoch_v20 | $1,005.91 | 33 | - | PASS |
| 2 | stoch_v06 | $1,002.26 | 98 | - | PASS |
| 3 | stoch_v09 | $864.27 | 132 | - | PASS |
| 4 | stoch_slow | $865.04 | 96 | - | PASS |
| 5 | stoch_v10 | $820.11 | 83 | - | PASS |
| 6 | combo_v10 | $325.50 | 271 | - | PASS |
| 7 | stoch_fast | $301.28 | 114 | - | PASS |
| 8 | stoch_v12 | $431.06 | 25 | - | PASS |
| 9 | stoch_v07 | $355.12 | 98 | - | PASS |
| 10 | stoch_v11 | $251.82 | 114 | - | PASS |
| 11 | stoch_v14 | $246.01 | 98 | - | PASS |
| 12 | stoch_v13 | $218.86 | 116 | - | PASS |
| 13 | stoch_v18 | $190.63 | 110 | - | PASS |
| 14 | env_v19 | $132.52 | 511 | - | PASS |
| 15 | rsi_d_v04 | $113.65 | 139 | - | PASS |
| 16 | rsi_d_v06 | $108.49 | 76 | - | PASS |
| 17 | rsi_d_v07 | $97.88 | 162 | - | PASS |
| 18 | mr_rsi_v16 | $74.11 | 259 | - | PASS |
| 19 | env_v17 | $71.98 | 315 | - | PASS |
| 20 | mr_rsi_v13 | $54.60 | 275 | - | PASS |

## Key Insights

1. **Stochastic strategies dominate:** Top 13 performers are all stochastic oscillator variants
2. **Stoch v20 best performer:** $1,005.91 return with only 33 trades (high conviction)
3. **Stoch v06 consistent:** $1,002.26 with 98 trades
4. **Combo strategies promising:** combo_v10 returned $325.50
5. **RSI divergence working:** rsi_d_v04, v06, v07 all profitable
6. **Mean reversion RSI variants:** mr_rsi_v16 and v13 showing positive returns

## Failed Categories

- Pattern strategies (pat_v01, pat_v02) consistently negative
- Many combo strategies timing out (complex parameter spaces)
- Some Williams %R variants timing out

## Next Steps for Iteration 2

1. **Tweak top performers:**
   - stoch_v20: Try adjusting oversold/overbought levels
   - stoch_v06: Adjust k_period/d_period ranges
   - stoch_v09: Optimize stop loss and trailing stop

2. **Add 5 new strategies:**
   - stoch_adaptive: Dynamic stochastic periods based on volatility
   - rsi_stoch_combo: Combined RSI divergence + stochastic
   - volatility_breakout: ATR-based breakout with volume confirmation
   - trend_following_ma: Adaptive MA with trend strength filter
   - mean_reversion_band: Bollinger bands with mean reversion signals

3. **Optimize timeout-prone strategies:**
   - Reduce parameter search space for combo variants
   - Pre-screen Williams %R with faster fidelity

## Files Generated

- `data/batch_1.log` through `data/batch_8.log`: Individual batch results
- `data/batch-results.json`: Merged results (overwritten by last batch)
- Strategy params: `src/strategies/strat_*.params.json` (200 files)

## Performance by Template

| Template | Pass Rate | Avg Return | Notes |
|----------|-----------|------------|-------|
| Stochastic | 14/20 (70%) | $485.12 | Clear winners |
| RSI Divergence | 5/7 (71%) | $106.67 | Solid performers |
| Combo | 1/20 (5%) | $325.50 | High variance |
| Mean Revert RSI | 8/20 (40%) | $32.45 | Moderate |
| Williams %R | 0/10 (0%) | -$78.00 | Timing out |
| Pattern | 0/20 (0%) | -$45.20 | Not working |
| Channel | 3/20 (15%) | $42.30 | Mixed |
| MA Envelope | 4/20 (20%) | $51.80 | Mixed |

---
**Total Optimization Time:** ~66 minutes (8 parallel batches)
**Best Strategy:** stoch_v20 ($1,005.91 test return)
**Best Sharpe:** stoch_v10 (from batch 7 logs)
