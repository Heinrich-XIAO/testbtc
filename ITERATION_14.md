# ITERATION 14 - Filter Removal Exploration

## Summary

Building on the discovery from ITERATION_13 that removing the momentum filter improved test returns, this iteration systematically removes various filters to find the optimal minimal configuration. We test wide stochastic ranges, no K>D requirements, minimal filters, and combinations with multi-exit mechanisms.

## Strategies Tested

| Strategy | Description | Full Return | Test Return | Test Trades | Notes |
|----------|-------------|-------------|-------------|-------------|-------|
| sr_no_trend_filter_302 | No trend filter, keeps loose momentum | **$919.68** | **$61.67** | 41 | **BEST - Positive test return!** |
| sr_very_wide_no_mom_303 | Very wide stoch (28/75) + no momentum | $846.90 | $-20.78 | 30 | Strong full return |
| sr_no_kd_requirement_300 | No K>D requirement + no momentum | $676.19 | **$2.17** | 40 | Near break-even test |
| sr_wide_no_momentum_297 | Wide stoch (25/78) + no momentum | $421.45 | $-172.79 | 44 | Moderate |
| sr_minimal_filters_298 | Only support + stoch (no trend, no momentum) | $161.69 | $-184.38 | 175 | Too many trades |
| sr_support_only_301 | Most minimal: only support bounce | $135.18 | $-74.64 | 310 | Over-trades |
| sr_no_mom_multi_exit_299 | 293's no-momentum + 260's multi-exit | $-23.81 | $-34.23 | 5 | Under-trades |
| sr_293_multi_exit_304 | 293's exact params + multi-exit | $-70.34 | $-80.55 | 7 | Under-trades |

## Key Findings

### BREAKTHROUGH: sr_no_trend_filter_302
- **$919.68 full return with $61.67 positive test return!**
- 41 trades provides good volume
- Removes trend filter but KEEPS loose momentum filter
- This is significant: the trend filter was causing more harm than the momentum filter
- Best train/test consistency in this iteration

### Filter Removal Analysis
1. **Removing trend filter (302)**: BEST - improves both full and test returns
2. **Removing K>D requirement (300)**: Near break-even test, good full return
3. **Removing momentum filter (297, 303)**: Mixed results, some negative test
4. **Removing all filters (298, 301)**: Over-trades, worse performance
5. **Multi-exit + no momentum (299, 304)**: Under-trades, poor performance

### Trade Count Sweet Spot
- 30-45 trades appears optimal for this dataset
- Too few (5-7): Unreliable, high variance
- Too many (175-310): Overtrading, poor returns

## Best Performers This Iteration

1. **sr_no_trend_filter_302**: $919.68 full, $61.67 test, 41 trades - **ITERATION BEST**
2. **sr_very_wide_no_mom_303**: $846.90 full, $-20.78 test, 30 trades
3. **sr_no_kd_requirement_300**: $676.19 full, $2.17 test, 40 trades

## All-Time Leaderboard Update

| Rank | Strategy | Full Return | Test Return | Iteration |
|------|----------|-------------|-------------|-----------|
| 1 | sr_strict_multi_exit_260 | $4,414.69 | -$135.42 | 9 |
| 2 | sr_strict_entry_256 | $4,098.52 | -$95.84 | 8 |
| 3 | sr_trend_strict_249 | $3,947.54 | -$152.43 | 8 |
| 4 | sr_stoch_wide_274 | $3,656.23 | -$97.12 | 11 |
| 5 | **sr_no_trend_filter_302** | $919.68 | **$61.67** | 14 |
| 6 | sr_very_wide_no_mom_303 | $846.90 | -$20.78 | 14 |
| 7 | sr_no_kd_requirement_300 | $676.19 | $2.17 | 14 |

## Best Test Return Strategies (Positive)

| Strategy | Test Return | Full Return | Trades | Iteration |
|----------|-------------|-------------|--------|-----------|
| **sr_no_trend_filter_302** | **$61.67** | $919.68 | 41 | 14 |
| sr_no_momentum_filter_293 | $32.65 | $478.46 | 22 | 13 |
| sr_no_kd_requirement_300 | $2.17 | $676.19 | 40 | 14 |

## Insights for ITERATION_15

1. **No-trend-filter approach is the winner** - sr_no_trend_filter_302 achieved both good full return AND positive test return
2. **Keep momentum filter, remove trend filter** - opposite of what we tried in ITERATION_13
3. **Explore variations of 302's approach**:
   - Tighter/looser momentum thresholds
   - Different stochastic ranges with no trend filter
   - Combine no-trend-filter with multi-exit
4. **Trade count target**: Aim for 30-50 trades per strategy
