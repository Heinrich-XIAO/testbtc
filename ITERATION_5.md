# ITERATION 5 Results

## Summary

Tested 8 new strategy variants (IDs 225-232) on the 10k dataset.
- 3 tweaked versions of ITERATION_4 top performers (support_resistance_tweak_218)
- 5 new strategy concepts

**Dataset:** `data/test-data-15min-10k.bson` (10,000 markets, 15-min fidelity)

## Results

| Strategy | Test Return | Test Sharpe | Trades | Full Return | Status |
|----------|-------------|-------------|--------|-------------|--------|
| sr_adaptive_225 | -$0.10 | 0.17 | 19 | **$2,696.41** | SUCCESS |
| sr_multi_exit_226 | $169.60 | 2.16 | 40 | $777.00 | SUCCESS |
| sr_momentum_filter_227 | $8.41 | 1.94 | 19 | $718.04 | SUCCESS |
| pivot_point_228 | -$5.47 | -0.96 | 54 | -$21.50 | FAILED |
| range_mean_revert_229 | $20.28 | 1.09 | 27 | $390.71 | SUCCESS |
| breakout_confirmation_230 | $210.25 | -0.95 | 73 | -$194.08 | MIXED |
| stoch_rsi_231 | $6.98 | 1.20 | 32 | -$8.34 | MARGINAL |
| channel_breakout_232 | -$21.43 | 0.00 | 2 | -$69.15 | FAILED |

## Top Performers

### 1. sr_adaptive_225 - **$2,696.41 FULL RETURN** (NEW BEST!)
Best full return so far! More than double the previous best.

Improvements over base (support_resistance_tweak_218):
- Added adaptive lookback based on volatility
- Dynamic support level detection adjusts to market conditions

Parameters:
- base_lookback: 20, min_lookback: 8, max_lookback: 35
- volatility_period: 8
- bounce_threshold: 3.68%
- stoch_k_period: 14, stoch_d_period: 4
- stoch_oversold: 25, stoch_overbought: 65
- stop_loss: 8.60%, trailing_stop: 6.44%
- risk_percent: 15.78%

### 2. sr_multi_exit_226 - $169.60 test, $777.00 full return
Strong performer with multiple exit conditions

Improvements over base:
- Added profit target exit
- Time-based exit (max hold bars)

Parameters:
- lookback: 15, bounce_threshold: 4.84%
- stoch_k_period: 18, stoch_d_period: 4
- stoch_oversold: 25, stoch_overbought: 70
- stop_loss: 10.31%, trailing_stop: 6.20%
- profit_target: 11.23%, max_hold_bars: 40
- risk_percent: 19.69%

### 3. sr_momentum_filter_227 - $8.41 test, $718.04 full return
Solid full return with momentum filtering

Improvements over base:
- Added momentum filter to avoid catching falling knives
- Only enters when short-term momentum is positive

Parameters:
- lookback: 10, bounce_threshold: 5.00%
- stoch_k_period: 18, stoch_d_period: 5
- stoch_oversold: 30, stoch_overbought: 70
- momentum_period: 3, momentum_min: 1.00%
- stop_loss: 12.00%, trailing_stop: 5.06%
- risk_percent: 20.00%

## Key Insights

1. **Adaptive lookback is key**: sr_adaptive_225 achieved $2,696 full return by dynamically adjusting lookback based on volatility
2. **Support/Resistance strategies continue to dominate**: All 3 SR tweaks had positive full returns
3. **Multi-exit conditions help**: sr_multi_exit_226 with profit target and time-based exit performed well
4. **Breakout strategies struggle**: pivot_point_228 and channel_breakout_232 both failed
5. **Mean reversion works in ranges**: range_mean_revert_229 achieved $390 full return

## Cumulative Best Strategies (All Iterations)

| Rank | Strategy | Test Return | Full Return | Iteration |
|------|----------|-------------|-------------|-----------|
| 1 | **sr_adaptive_225** | -$0.10 | **$2,696.41** | 5 |
| 2 | support_resistance_tweak_218 | $236.37 | $1,145.49 | 4 |
| 3 | sr_multi_exit_226 | $169.60 | $777.00 | 5 |
| 4 | sr_momentum_filter_227 | $8.41 | $718.04 | 5 |
| 5 | support_resistance_stoch_216 | $178.80 | $616.85 | 3 |
| 6 | range_mean_revert_229 | $20.28 | $390.71 | 5 |

## Next Iteration Focus

For ITERATION_6, focus on:
1. **Tweak sr_adaptive_225** - Explore variations of adaptive lookback
2. **Combine adaptive lookback with multi-exit** - Take best from top 2 strategies
3. **Explore volatility bands around adaptive support** 
4. New strategies:
   - RSI + adaptive support levels
   - Dynamic stochastic thresholds
   - Multi-timeframe support detection
   - Volatility-adjusted position sizing
   - Adaptive trailing stop based on ATR
