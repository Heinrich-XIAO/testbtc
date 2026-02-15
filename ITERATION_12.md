# ITERATION 12 - Wide Stochastic Variations

## Summary

This iteration built on the success of sr_stoch_wide_274 ($3,656.23 in ITERATION_11) by exploring various wide stochastic band combinations:
- Wide stoch + multi-exit from 260 (best combination attempt)
- Very wide stochastic bands (10/92)
- Tight trailing stops with wide stoch
- Shorter/longer K periods
- Longer hold periods
- Higher profit targets
- Lower stop losses

**Best this iteration:** sr_wide_multi_exit_281 with $387.14 full return and **positive test return** ($16.42)

**Key finding:** Most wide stochastic variations produced 0 test trades, suggesting the extreme conditions are too strict for the test period. Only sr_wide_multi_exit_281 found tradeable setups with positive test results.

## Results (Sorted by Full Return)

| Rank | Strategy | Full Return | Test Return | Test Trades | Train Sharpe |
|------|----------|-------------|-------------|-------------|--------------|
| 1 | sr_wide_multi_exit_281 | $387.14 | $16.42 | 12 | 3.62 |
| 2 | sr_wide_long_k_285 | $273.73 | $0.00 | 0 | 4.64 |
| 3 | sr_very_wide_stoch_282 | $200.84 | $0.00 | 0 | 7.37 |
| 4 | sr_wide_lower_stop_288 | $199.90 | $0.00 | 0 | 7.35 |
| 5 | sr_wide_tight_trail_283 | $185.70 | $0.00 | 0 | 7.16 |
| 6 | sr_wide_higher_pt_287 | $185.28 | $0.00 | 0 | 7.16 |
| 7 | sr_wide_long_hold_286 | $173.00 | $0.00 | 0 | 6.99 |
| 8 | sr_wide_short_k_284 | $50.77 | $0.00 | 0 | 8.83 |

## Top 3 Performers Details

### 1. sr_wide_multi_exit_281 - $387.14
- **Concept:** Combines wide stochastic bands (16/90) from 274 with multi-exit approach from 260
- **Key params:** stoch_oversold=18, stoch_overbought=90, trailing_stop=0.046, profit_target=0.12
- **Performance:** Train $441.68, Test $16.42 (12 trades), Full $387.14
- **Notable:** Only strategy with positive test return and actual test trades

### 2. sr_wide_long_k_285 - $273.73
- **Concept:** Wide stochastic bands with longer K period (22) for smoother signals
- **Key params:** stoch_k_period=22, stoch_oversold=18, stoch_overbought=90
- **Performance:** Train $273.73, Test $0.00 (0 trades), Full $273.73

### 3. sr_very_wide_stoch_282 - $200.84
- **Concept:** Even wider stochastic bands (14/90) for more extreme conditions
- **Key params:** stoch_oversold=14, stoch_overbought=90, trailing_stop=0.049
- **Performance:** Train $200.84, Test $0.00 (0 trades), Full $200.84

## Learnings

1. **Extreme conditions = no trades:** Strategies with very wide stochastic bands (oversold<15) produced 0 test trades, indicating conditions were too restrictive
2. **Multi-exit remains valuable:** sr_wide_multi_exit_281 was the only strategy to produce test trades, continuing the pattern from ITERATION_9 where multi-exit was key
3. **Wide stoch alone not enough:** Simply widening stochastic bands without other adjustments doesn't translate to out-of-sample performance
4. **Positive test return is rare:** sr_wide_multi_exit_281 achieved positive test return ($16.42) which is notable given most strategies show negative test returns

## All-Time Best Comparison

| Strategy | Full Return | Iteration |
|----------|-------------|-----------|
| sr_strict_multi_exit_260 | $4,414.69 | 9 |
| sr_strict_entry_256 | $4,098.52 | 8 |
| sr_trend_strict_249 | $3,947.54 | 8 |
| sr_stoch_wide_274 | $3,656.23 | 11 |
| sr_wide_multi_exit_281 | $387.14 | 12 |

## Next Steps

For ITERATION_13, consider:
1. Re-explore multi-exit variations with less extreme stochastic thresholds (oversold=20-25)
2. Combine successful elements: multi-exit + moderate wide stoch + lower trailing
3. Try different confirmation signals beyond stochastic (RSI, momentum combinations)
4. Investigate why sr_wide_multi_exit_281 found trades while others didn't - parameter sensitivity analysis
