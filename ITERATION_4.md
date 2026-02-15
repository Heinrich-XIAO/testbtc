# ITERATION 4 Results

## Summary

Tested 8 new strategy variants (IDs 217-224) on the 10k dataset.
- 3 tweaked versions of ITERATION_3 top performers
- 5 new strategy concepts

**Dataset:** `data/test-data-15min-10k.bson` (10,000 markets, 15-min fidelity)

## Results

| Strategy | Test Return | Test Sharpe | Trades | Full Return | Status |
|----------|-------------|-------------|--------|-------------|--------|
| momentum_vol_tweak_217 | $265.64 | 2.14 | 139 | -$198.86 | SUCCESS |
| support_resistance_tweak_218 | $236.37 | 1.45 | 43 | $1,145.49 | SUCCESS |
| keltner_tweak_219 | -$12.60 | 0.54 | 176 | -$81.03 | FAILED |
| dual_momentum_220 | -$405.13 | 1.50 | 248 | -$23.13 | FAILED |
| price_range_breakout_221 | $0.00 | 0.00 | 0 | $0.00 | FAILED (no trades) |
| velocity_222 | -$175.17 | 1.87 | 372 | N/A | FAILED |
| triple_ema_223 | -$68.49 | 1.14 | 647 | N/A | FAILED |
| mean_rev_momentum_224 | N/A | N/A | N/A | N/A | TIMEOUT |

## Top Performers

### 1. support_resistance_tweak_218 - $236.37 (43 trades)
**BEST FULL RETURN: $1,145.49** - Highest performing strategy so far!

Improvements over base (support_resistance_stoch_216):
- Added trailing stop for profit protection
- Multiple support level detection

Parameters:
- lookback: 15
- bounce_threshold: 0.037
- stoch_k_period: 14, stoch_d_period: 4
- stoch_oversold: 25, stoch_overbought: 65
- stop_loss: 9.87%, trailing_stop: 4.89%
- risk_percent: 15.20%

### 2. momentum_vol_tweak_217 - $265.64 (139 trades)
Good test return but negative full return indicates potential overfit

Improvements over base (momentum_vol_212):
- Added EMA trend filter
- Tighter volatility confirmation

Parameters:
- momentum_period: 12, momentum_threshold: 0.040
- volatility_period: 16, volatility_multiplier: 1.03
- ema_period: 20
- stop_loss: 4.14%, trailing_stop: 4.91%
- risk_percent: 24.09%

## Key Insights

1. **Trailing stop enhancement works**: support_resistance_tweak_218 added trailing stop and achieved $1,145 full return
2. **Support/Resistance strategies dominate**: Both SR strategies (216, 218) are top performers
3. **Keltner with momentum didn't improve**: Adding momentum filter made keltner_tweak_219 worse
4. **New strategy concepts underperformed**:
   - price_range_breakout_221 - Too restrictive, no trades
   - velocity_222 - Negative returns despite high trade count
   - triple_ema_223 - Too many trades (647), negative returns
   - dual_momentum_220 - Volatility adjustment hurt performance

## Cumulative Best Strategies (All Iterations)

| Rank | Strategy | Test Return | Full Return | Iteration |
|------|----------|-------------|-------------|-----------|
| 1 | support_resistance_tweak_218 | $236.37 | $1,145.49 | 4 |
| 2 | support_resistance_stoch_216 | $178.80 | $616.85 | 3 |
| 3 | momentum_vol_tweak_217 | $265.64 | -$198.86 | 4 |
| 4 | momentum_vol_212 | $226.55 | -$385.27 | 3 |

## Next Iteration Focus

For ITERATION_5, focus on:
1. **Tweak support_resistance_tweak_218** - Best full return, explore variations
2. **Combine SR with momentum filtering** - Take best of both approaches
3. **Reduce overfit in momentum strategies** - momentum_vol variants have good test but negative full
4. New strategies:
   - Adaptive support/resistance with dynamic lookback
   - Stochastic + price action patterns
   - Simplified momentum with SR exit
   - Mean reversion only at strong support levels
   - Volatility-filtered SR bounces
