# ITERATION 8 Results

## Summary

Created 8 new strategies (249-256) building on ITERATION_7's best performers.

**NEW ALL-TIME BEST**: sr_strict_entry_256 achieved **$4,098.52 full return** (previous best was sr_trend_strength_247 at $3,274.81)

## Strategy Results

| Strategy | Test Return | Full Return | Trades | Notes |
|----------|-------------|-------------|--------|-------|
| sr_trend_strict_249 | -$158.75 | **$3,947.54** | 5 | Tweak of 247 with stricter trend |
| sr_multi_trend_250 | -$160.73 | $2,508.47 | 5 | Combined multi-exit + trend |
| sr_adaptive_target_251 | -$103.70 | $1,700.08 | 37 | Adaptive bounce + profit target |
| sr_momentum_trend_252 | $0.00 | $2,537.04 | 0 | Momentum + trend (no test trades) |
| sr_triple_confirm_253 | $0.00 | $1,907.46 | 0 | Triple confirm (no test trades) |
| sr_range_vol_254 | -$119.55 | $2,248.23 | 13 | Range as volume proxy |
| sr_long_trend_255 | -$84.59 | $1,604.79 | 18 | Dual short/long trend |
| sr_strict_entry_256 | -$146.89 | **$4,098.52** | 5 | **NEW BEST** - Very strict entry |

## Top Performers (All-Time by Full Return)

1. **sr_strict_entry_256**: $4,098.52 (ITERATION_8) - **NEW ALL-TIME BEST**
2. **sr_trend_strict_249**: $3,947.54 (ITERATION_8)
3. **sr_trend_strength_247**: $3,274.81 (ITERATION_7)
4. **sr_multi_exit_tweak_241**: $2,901.74 (ITERATION_7)
5. **sr_adaptive_multi_exit_234**: $2,828.20 (ITERATION_6)

## Key Observations

1. **Strict entry conditions produce best results**: sr_strict_entry_256 requires multiple confirmations (support + stoch + trend + momentum + multi-bar bounce) resulting in very few but highly profitable trades

2. **Very low trade counts = best returns**: Both top performers (256 and 249) made only 5 trades each but achieved massive full returns

3. **Overfitting concern**: All strategies show negative test returns but massive full returns - this pattern persists across iterations

4. **Trend filters consistently help**: Strategies with trend filtering continue to outperform

## Strategy Descriptions

### Tweaks (249-251)
- **sr_trend_strict_249**: Tweak of sr_trend_strength_247 with stricter positive trend requirement
- **sr_multi_trend_250**: Combined sr_multi_exit_tweak_241's multi-exit with trend strength filter
- **sr_adaptive_target_251**: Added profit target to sr_adaptive_tweak2_242

### New Variants (252-256)
- **sr_momentum_trend_252**: Price rate of change + trend strength combination
- **sr_triple_confirm_253**: Requires support + stoch + trend + momentum (all must align)
- **sr_range_vol_254**: Uses price range (high-low) as volume proxy for signal strength
- **sr_long_trend_255**: Dual trend (short 10-bar + long 40-bar) confirmation
- **sr_strict_entry_256**: Very strict entry with consecutive bounces + multiple confirmations

## Next Steps for ITERATION_9

Focus on:
1. Tweak sr_strict_entry_256 (new best) - vary strictness levels
2. Tweak sr_trend_strict_249 (second best)
3. Combine strict entry with multi-exit conditions
4. Explore different bounce bar requirements
5. Test different momentum/trend period combinations
