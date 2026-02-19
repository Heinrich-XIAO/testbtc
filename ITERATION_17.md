# ITERATION 17 - Support/Resistance No-Trend-Filter Batch (v16) Results

## Summary

This iteration ran batch optimization for all 30 sr_ntf_v16 strategies prepared in ITERATION_16. **All 30 strategies passed** with test returns ranging from $61.36 to $188.87.

## Optimization Details

- **Date:** 2026-02-18/19
- **Dataset:** data/test-data.bson (default)
- **Method:** Differential Evolution, 30 iterations, 5 attempts per strategy
- **Timeout:** 15 minutes per strategy

## Results Summary

### Top 10 Performers

| Rank | Strategy | Test Return | Full Return | Trades | Key Parameters |
|------|----------|-------------|-------------|--------|----------------|
| 1 | sr_ntf_v16_010 | $188.87 | - | 37 | lookback=36, tp=0.104 |
| 2 | sr_ntf_v16_025 | $188.84 | $1,106.59 | 37 | lookback=12, tp=0.170 |
| 3 | sr_ntf_v16_004 | $188.58 | - | 37 | lookback=20, tp=0.166 |
| 4 | sr_ntf_v16_029 | $188.44 | $1,100.01 | 37 | lookback=36, tp=0.104 |
| 5 | sr_ntf_v16_014 | $188.13 | - | 37 | lookback=20, tp=0.166 |
| 6 | sr_ntf_v16_022 | $188.05 | - | 37 | lookback=36, tp=0.104 |
| 7 | sr_ntf_v16_002 | $186.69 | - | 37 | lookback=20, tp=0.166 |
| 8 | sr_ntf_v16_023 | $186.69 | - | 37 | lookback=20, tp=0.166 |
| 9 | sr_ntf_v16_020 | $186.51 | - | 37 | lookback=36, tp=0.104 |
| 10 | sr_ntf_v16_007 | $186.43 | - | 37 | lookback=20, tp=0.166 |

### All Strategies Results

| # | Strategy | Test Return | Full Return | Trades | Status |
|---|----------|-------------|-------------|--------|--------|
| 01 | sr_ntf_v16_001 | $130.21 | - | 33 | PASS |
| 02 | sr_ntf_v16_002 | $186.69 | - | 37 | PASS |
| 03 | sr_ntf_v16_003 | $120.21 | - | 33 | PASS |
| 04 | sr_ntf_v16_004 | $188.58 | - | 37 | PASS |
| 05 | sr_ntf_v16_005 | $171.39 | - | 37 | PASS |
| 06 | sr_ntf_v16_006 | $129.97 | - | 33 | PASS |
| 07 | sr_ntf_v16_007 | $186.43 | - | 37 | PASS |
| 08 | sr_ntf_v16_008 | $130.04 | - | 33 | PASS |
| 09 | sr_ntf_v16_009 | $61.36 | - | 41 | PASS |
| 10 | sr_ntf_v16_010 | $188.87 | - | 37 | PASS |
| 11 | sr_ntf_v16_011 | $170.74 | - | 37 | PASS |
| 12 | sr_ntf_v16_012 | $143.15 | - | 31 | PASS |
| 13 | sr_ntf_v16_013 | $119.96 | - | 33 | PASS |
| 14 | sr_ntf_v16_014 | $188.13 | - | 37 | PASS |
| 15 | sr_ntf_v16_015 | $185.35 | - | 37 | PASS |
| 16 | sr_ntf_v16_016 | $132.12 | - | 33 | PASS |
| 17 | sr_ntf_v16_017 | $186.24 | - | 37 | PASS |
| 18 | sr_ntf_v16_018 | $130.11 | - | 33 | PASS |
| 19 | sr_ntf_v16_019 | $141.09 | - | 39 | PASS |
| 20 | sr_ntf_v16_020 | $186.51 | - | 37 | PASS |
| 21 | sr_ntf_v16_021 | $186.31 | - | 37 | PASS |
| 22 | sr_ntf_v16_022 | $188.05 | - | 37 | PASS |
| 23 | sr_ntf_v16_023 | $186.69 | - | 37 | PASS |
| 24 | sr_ntf_v16_024 | $130.21 | $998.19 | 33 | PASS |
| 25 | sr_ntf_v16_025 | $188.84 | $1,106.59 | 37 | PASS |
| 26 | sr_ntf_v16_026 | $185.85 | $1,095.10 | 37 | PASS |
| 27 | sr_ntf_v16_027 | $186.19 | $1,098.06 | 37 | PASS |
| 28 | sr_ntf_v16_028 | $129.91 | $993.58 | 33 | PASS |
| 29 | sr_ntf_v16_029 | $188.44 | $1,100.01 | 37 | PASS |
| 30 | sr_ntf_v16_030 | $130.20 | $1,003.37 | 33 | PASS |

## Key Insights

### Parameter Convergence

Top performers converged to two main parameter clusters:

**Cluster A (lookback=36, ~$188 test return):**
- lookback: 36
- bounce_threshold: ~0.021
- stop_loss: ~0.065
- risk_percent: ~0.35
- take_profit: ~0.104

**Cluster B (lookback=12-20, ~$186-188 test return):**
- lookback: 12-20
- bounce_threshold: ~0.021
- stop_loss: ~0.064
- risk_percent: ~0.35
- take_profit: ~0.166-0.170

### Observations

1. **All strategies profitable**: 100% pass rate indicates robust strategy template
2. **Two performance tiers**: ~$186-188 (high) vs ~$130 (moderate)
3. **Trade count correlates with return**: 37 trades → high returns, 33 trades → moderate
4. **Higher risk (35%) improves returns**: Previous iterations used lower risk
5. **Tight stop loss (6.4-6.5%) optimal**: Prevents large losses while allowing winners

## Comparison with Previous Best

| Strategy | Test Return | Full Return | Iteration |
|----------|-------------|-------------|-----------|
| sr_no_trend_tight_stoch_309 | $163.83 | $1,363.16 | 15 |
| sr_tight_momentum_306 | $170.14 | $916.13 | 15 |
| **sr_ntf_v16_010** | **$188.87** | - | **17** |
| **sr_ntf_v16_025** | **$188.84** | **$1,106.59** | **17** |

**sr_ntf_v16_010 sets new record for test return!**

## Next Steps for ITERATION 18

1. **Fine-tune around top parameters:**
   - Create variants with lookback 30-40, bounce_threshold 0.018-0.025
   - Test tighter/wider stop losses (0.05-0.08)
   - Explore risk_percent 0.30-0.40

2. **Test on large dataset:**
   - Run top performers on `data/test-data-15min-large.bson`
   - Compare train/test consistency

3. **Create combined strategy:**
   - Blend best parameters from v16_010 and v16_025
   - Test ensemble approach

## Files Modified

- `src/strategies/strat_sr_ntf_v16_*.params.json` - Updated with optimized parameters
- `ATTEMPTED.md` - Added iteration 17 results
- `data/batch-results.json` - Batch optimization results
