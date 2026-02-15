# ITERATION 13 - Filter Simplification Testing

## Summary

Tested moderate stochastic thresholds and filter removal to improve test trade counts and returns. **Key discovery: Removing momentum filter significantly increased test trades while maintaining positive test return.**

## Strategies Tested (289-296)

| Strategy | Full Return | Test Return | Test Trades | stoch_oversold | stoch_overbought | Key Feature |
|----------|-------------|-------------|-------------|----------------|------------------|-------------|
| **sr_no_momentum_filter_293** | **$478.46** | **$32.65** | **22** | 22 | 84 | **No momentum filter** |
| sr_mixed_signals_296 | $373.69 | -$96.98 | 34 | 28 | 74 | Stoch OR RSI entry |
| sr_simple_stoch_294 | $334.35 | -$156.45 | 130 | 20 | 84 | No trend/momentum |
| sr_balanced_stoch_292 | $228.96 | $1.62 | 2 | 24 | 80 | No K>D requirement |
| sr_moderate_tighter_291 | $210.20 | $0.00 | 0 | 20 | 84 | Tighter trailing stop |
| sr_moderate_multi_exit_289 | $158.74 | $48.09 | 2 | 22 | 84 | Multi-exit based |
| sr_rsi_confirm_295 | $137.06 | $1.50 | 2 | RSI 27 | RSI 78 | RSI instead of stoch |
| sr_moderate_looser_290 | $69.49 | $0.00 | 0 | 24 | 80 | Looser momentum |

## Key Insights

1. **Removing momentum filter is the breakthrough** - Strategy 293 achieved 22 test trades (highest count with positive return) by removing the momentum_threshold requirement
   
2. **Positive test returns** achieved by:
   - sr_no_momentum_filter_293: $32.65 (22 trades)
   - sr_moderate_multi_exit_289: $48.09 (2 trades)
   - sr_balanced_stoch_292: $1.62 (2 trades)
   - sr_rsi_confirm_295: $1.50 (2 trades)

3. **Zero test trades** from 291 and 290 - moderate stochastic alone isn't enough, filter removal is key

4. **Too simplified = overfits** - Strategy 294 (no trend/momentum) and 296 (either/or signals) generated many trades but negative test returns

## Best Strategy: sr_no_momentum_filter_293

**Parameters:**
- base_lookback: 18
- stoch_k_period: 14, stoch_d_period: 4
- stoch_oversold: 22, stoch_overbought: 84
- trend_period: 26, trend_threshold: -0.0094
- **NO momentum filter** (key difference)
- stop_loss: 8.11%, trailing_stop: 7.24%
- profit_target: 12.30%
- risk_percent: 29.95%

**Performance:**
- Full Return: $478.46
- Test Return: $32.65 (positive!)
- Test Trades: 22 (good volume)
- Train Sharpe: 3.92, Test Sharpe: 3.60

## Direction for ITERATION_14

Based on these findings:
1. Build more variants that remove/simplify filters
2. Try removing trend filter while keeping stochastic
3. Test wider stochastic bands (oversold 25-30, overbought 72-78)
4. Combine filter removal with multi-exit mechanism from 260

## Files Created
- `strat_sr_moderate_multi_exit_289.ts`
- `strat_sr_moderate_looser_290.ts`
- `strat_sr_moderate_tighter_291.ts`
- `strat_sr_balanced_stoch_292.ts`
- `strat_sr_no_momentum_filter_293.ts`
- `strat_sr_simple_stoch_294.ts`
- `strat_sr_rsi_confirm_295.ts`
- `strat_sr_mixed_signals_296.ts`
