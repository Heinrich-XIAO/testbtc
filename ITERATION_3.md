# ITERATION 3 Results

## Summary

Tested 8 new strategy variants (IDs 209-216) on the 10k dataset.

**Dataset:** `data/test-data-15min-10k.bson` (10,000 markets, 15-min fidelity)

## Results

| Strategy | Test Return | Test Sharpe | Trades | Full Return | Status |
|----------|-------------|-------------|--------|-------------|--------|
| stoch_v20_tweak2_209 | $423.80 | 6.25 | 3 | $567.77 | SUCCESS (low trades) |
| momentum_vol_212 | $226.55 | 1.51 | 167 | -$385.27 | SUCCESS |
| support_resistance_stoch_216 | $178.80 | 1.98 | 33 | $616.85 | SUCCESS |
| keltner_breakout_214 | $45.19 | 0.69 | 357 | -$2.01 | SUCCESS |
| stoch_v06_tweak2_211 | -$38.69 | 1.53 | 8 | -$10.82 | FAILED |
| macd_stoch_combo_215 | -$52.13 | 1.31 | 139 | N/A | FAILED |
| roc_adaptive_213 | -$60.99 | 1.12 | 303 | N/A | FAILED |
| mean_reversion_band2_210 | $0.00 | 0.00 | 0 | $0.00 | FAILED (no trades) |

## Top 3 Performers

### 1. stoch_v20_tweak2_209 - $423.80 (3 trades)
**Caution:** Very low trade count - may be overfitted or unreliable

Parameters:
- k_period: 6, d_period: 2
- oversold_base: 25, overbought_base: 75
- volatility_period: 10
- level_adjustment_factor: 0.27
- momentum_period: 6, momentum_threshold: 0.017
- stop_loss: 5.12%, risk_percent: 18.87%

### 2. momentum_vol_212 - $226.55 (167 trades)
**Best balanced performer** - Good trade volume with positive returns

Parameters:
- momentum_period: 8
- momentum_threshold: 0.036
- volatility_period: 16
- volatility_multiplier: 1.02
- stop_loss: 4.33%, trailing_stop: 3.42%
- risk_percent: 19.37%

### 3. support_resistance_stoch_216 - $178.80 (33 trades)
**Highest full return** - $616.85 on full dataset

Parameters:
- lookback: 15
- bounce_threshold: 0.028
- stoch_k_period: 16, stoch_d_period: 4
- stoch_oversold: 25, stoch_overbought: 65
- stop_loss: 6.97%, risk_percent: 17.65%

## Key Insights

1. **Momentum strategies working well**: momentum_vol_212 shows consistent performance with good trade volume
2. **Support/Resistance with Stochastic**: support_resistance_stoch_216 has best full-dataset return ($616.85)
3. **Keltner breakout viable**: keltner_breakout_214 shows promise with high trade volume (357 trades)
4. **MTF stochastic underperforming**: stoch_v06_tweak2_211 failed despite MTF enhancements
5. **Mean reversion band needs work**: mean_reversion_band2_210 generated no trades - signal too restrictive

## Failed Strategies Analysis

- **mean_reversion_band2_210**: Entry conditions too restrictive - no trades generated
- **stoch_v06_tweak2_211**: MTF filter may be filtering out too many opportunities
- **roc_adaptive_213**: Adaptive thresholds not calibrated well - many trades but negative returns
- **macd_stoch_combo_215**: MACD+Stoch combination too slow to react

## Next Iteration Focus

For ITERATION_4, focus on:
1. **Tweak momentum_vol_212** - Best balanced performer, explore parameter variations
2. **Tweak support_resistance_stoch_216** - Highest full return, optimize further
3. **Tweak keltner_breakout_214** - High trade volume, improve profitability
4. Add 5 new strategies based on winning patterns:
   - Momentum + volatility variants
   - Support/resistance combinations
   - Channel breakout strategies
   - Hybrid momentum-mean-reversion approaches
   - Adaptive period strategies
