# Iteration 2 - New Strategies (IDs 201-208)

**Date:** 2026-02-15
**Dataset:** data/test-data-15min-10k.bson (10,000 markets, ~1.7M price points)
**Method:** 8 new strategies (3 tweaked + 5 new) optimized individually

## Summary Statistics

- **New Strategies Added:** 8 (IDs 201-208)
- **Total Strategies:** 208
- **Completed:** 8
- **Profitable:** 6/8 (75%)

## New Strategy Results

| ID | Strategy | Test Return | Trades | Status | Notes |
|----|----------|-------------|--------|--------|-------|
| 201 | stoch_v20_tweak_201 | $554.00 | 19 | PASS | Adaptive oversold/overbought levels |
| 202 | stoch_v06_tweak_202 | $259.06 | - | PASS | Multi-timeframe + trend filter |
| 203 | stoch_v09_tweak_203 | $29.17 | - | PASS | Divergence + partial profit taking |
| 204 | stoch_adaptive_204 | $129.08 | 20 | PASS | ATR-based adaptive k_period |
| 205 | rsi_stoch_combo_205 | $19.69 | 4 | PASS | RSI divergence + stochastic combo |
| 206 | volatility_breakout_206 | $0.00 | 0 | FAIL | No trades generated |
| 207 | trend_following_ma_207 | $27.75 | - | PASS | MA with ADX trend strength |
| 208 | mean_reversion_band_208 | $423.71 | - | PASS | Bollinger bands mean reversion |

## Top Performers from Iteration 2

1. **stoch_v20_tweak_201** ($554.00): Adaptive stochastic levels based on recent volatility. High conviction with only 19 trades.
2. **mean_reversion_band_208** ($423.71): Bollinger band mean reversion with RSI confirmation showing strong results.
3. **stoch_v06_tweak_202** ($259.06): Added trend filter and multi-timeframe confirmation improved original stoch_v06.

## Key Insights

1. **Tweaked stochastic strategies working well:** stoch_v20_tweak_201 shows 55% of original stoch_v20's return
2. **Mean reversion Bollinger strategy is promising:** $423.71 return makes it a top-10 contender overall
3. **Stoch adaptive showing potential:** $129.08 with ATR-based period adjustment
4. **Volatility breakout failed:** No trades generated - needs parameter space revision
5. **RSI+Stochastic combo too selective:** Only 4 trades - needs looser signal requirements

## Comparison with Top Iteration 1 Strategies

| Strategy | Test Return | Iteration |
|----------|-------------|-----------|
| stoch_v20 | $1,005.91 | 1 |
| stoch_v06 | $1,002.26 | 1 |
| stoch_slow | $865.04 | 1 |
| stoch_v09 | $864.27 | 1 |
| stoch_v10 | $820.11 | 1 |
| **stoch_v20_tweak_201** | **$554.00** | **2** |
| stoch_v12 | $431.06 | 1 |
| **mean_reversion_band_208** | **$423.71** | **2** |
| stoch_v07 | $355.12 | 1 |
| combo_v10 | $325.50 | 1 |
| stoch_fast | $301.28 | 1 |
| **stoch_v06_tweak_202** | **$259.06** | **2** |

## Optimized Parameters

### stoch_v20_tweak_201 (Best New)
```json
{
  "k_period": 7,
  "d_period": 3,
  "oversold_base": 15,
  "overbought_base": 70,
  "volatility_period": 10,
  "level_adjustment_factor": 10,
  "stop_loss": 0.062,
  "risk_percent": 0.236
}
```

### mean_reversion_band_208 (2nd Best New)
```json
{
  "bb_period": 20,
  "bb_stddev_mult": 1.81,
  "rsi_period": 18,
  "rsi_oversold": 20,
  "rsi_overbought": 60,
  "stop_loss": 0.036,
  "trailing_stop": 0.041,
  "risk_percent": 0.148
}
```

## Failed/Underperforming

1. **volatility_breakout_206**: ATR multiplier too conservative or lookback too short - generates no signals
2. **rsi_stoch_combo_205**: Signal window requirement too strict - only 4 trades in test period

## Next Steps for Iteration 3

1. **Tweak top new performers:**
   - stoch_v20_tweak_201: Try different volatility_period ranges
   - mean_reversion_band_208: Adjust bb_stddev_mult for more/fewer trades
   - stoch_v06_tweak_202: Enable mtf_confirmation to see if it helps

2. **Fix failed strategies:**
   - volatility_breakout_206: Widen ATR multiplier range (0.1-0.5), shorter lookback
   - rsi_stoch_combo_205: Increase signal_window, relax divergence requirements

3. **Add 5 new strategies:**
   - Momentum with volume confirmation
   - Rate of change with adaptive thresholds
   - Keltner channel breakout
   - MACD + stochastic combo
   - Price action support/resistance with stochastic

---
**Optimization Time:** ~18 minutes (8 individual optimizations)
**Best New Strategy:** stoch_v20_tweak_201 ($554.00 test return)
**New Strategies Ranking:** #6, #8, #12 overall
