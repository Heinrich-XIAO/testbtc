# ITERATION 16 - Support/Resistance No-Trend-Filter Batch (v16)

## Summary

This iteration prepares 30 support/resistance no-trend-filter parameter variants for batch optimization. Building on insights from ITERATION_15 (where `sr_no_trend_tight_stoch_309` achieved $1,363.16 full return with $163.83 positive test return), these variants explore the parameter space around tight stochastic (14/84), tight momentum (0.012), and bounce requirements.

## Strategies Prepared

| Strategy | Description | Status |
|----------|-------------|--------|
| sr_ntf_v16_001 | Base variant with tight stoch (14/84) | Prepared |
| sr_ntf_v16_002 | Tight momentum (0.012) variant | Prepared |
| sr_ntf_v16_003 | Higher profit target (18%) | Prepared |
| sr_ntf_v16_004 | Lower risk (20%) variant | Prepared |
| sr_ntf_v16_005 | Single bounce requirement | Prepared |
| sr_ntf_v16_006 | Wider lookback range | Prepared |
| sr_ntf_v16_007 | Tighter stop loss (5%) | Prepared |
| sr_ntf_v16_008 | Wider trailing stop (8%) | Prepared |
| sr_ntf_v16_009 | Longer max hold (40 bars) | Prepared |
| sr_ntf_v16_010 | Shorter max hold (24 bars) | Prepared |
| sr_ntf_v16_011 | Lower stochastic K (18) | Prepared |
| sr_ntf_v16_012 | Higher stochastic D (8) | Prepared |
| sr_ntf_v16_013 | Wider stochastic oversold (18) | Prepared |
| sr_ntf_v16_014 | Narrower stochastic overbought (80) | Prepared |
| sr_ntf_v16_015 | Moderate bounce threshold (0.025) | Prepared |
| sr_ntf_v16_016 | Higher bounce threshold (0.04) | Prepared |
| sr_ntf_v16_017 | Lower bounce threshold (0.015) | Prepared |
| sr_ntf_v16_018 | Higher risk (30%) variant | Prepared |
| sr_ntf_v16_019 | Moderate profit target (12%) | Prepared |
| sr_ntf_v16_020 | Very tight momentum (0.008) | Prepared |
| sr_ntf_v16_021 | Looser momentum (0.018) | Prepared |
| sr_ntf_v16_022 | Moderate stochastic K (14) | Prepared |
| sr_ntf_v16_023 | Wider volatility period (14) | Prepared |
| sr_ntf_v16_024 | Narrower volatility period (6) | Prepared |
| sr_ntf_v16_025 | Extended lookback (30) | Prepared |
| sr_ntf_v16_026 | Shorter lookback (12) | Prepared |
| sr_ntf_v16_027 | Balanced stoch params | Prepared |
| sr_ntf_v16_028 | Aggressive profit target (22%) | Prepared |
| sr_ntf_v16_029 | Conservative stop loss (8%) | Prepared |
| sr_ntf_v16_030 | Mixed optimization variant | Prepared |

## Parameter Space Explored

- **Lookback**: 8-36 bars
- **Bounce Threshold**: 0.015-0.04
- **Stochastic K Period**: 14-22
- **Stochastic D Period**: 5-8
- **Stochastic Oversold**: 12-18
- **Stochastic Overbought**: 80-86
- **Momentum Threshold**: 0.008-0.018
- **Stop Loss**: 0.04-0.08
- **Trailing Stop**: 0.06-0.10
- **Profit Target**: 0.10-0.22
- **Max Hold Bars**: 24-40
- **Risk Percent**: 0.20-0.35

## Key Insights from ITERATION_15

1. **Tight stochastic (14) beats wide stochastic** - requires truly oversold conditions
2. **Tight momentum (0.012) produces best test returns** - quality over quantity
3. **No trend filter + tight indicators = optimal** - removes harmful filter, keeps quality filters
4. **Multi-exit mechanisms hurt performance** when combined with no-trend approach
5. **Lower risk (20%) still profitable** but sacrifices returns

## Next Steps

1. Run batch optimization for all 30 variants:
   ```bash
   bun run scripts/batch-optimize.ts --only sr_ntf_v16_001,sr_ntf_v16_002,...,sr_ntf_v16_030 --iterations 30 --attempts 5 --timeout-minutes 20 --concurrency 1
   ```
2. Analyze results and identify top performers
3. Document successful variants in ATTEMPTED.md
4. Create ITERATION_17 with refined parameter ranges

## Files Created

- `src/strategies/strat_sr_ntf_v16_001.params.json` through `strat_sr_ntf_v16_030.params.json`
- Updated `scripts/run-optimization.ts` with strategy registrations
