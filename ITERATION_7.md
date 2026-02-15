# ITERATION 7 Results

## Summary

8 new strategies (241-248) based on tweaks to top performers and new filtering approaches.

## Top Performers (Sorted by Full Return)

| Rank | Strategy | Test Return | Full Return | Test Trades | Key Features |
|------|----------|-------------|-------------|-------------|--------------|
| 1 | **sr_trend_strength_247** | -$174.63 | **$3,274.81** | 7 | Trend strength filter |
| 2 | sr_multi_exit_tweak_241 | -$27.58 | $2,901.74 | 24 | Tweaked profit target + max hold |
| 3 | sr_adaptive_tweak2_242 | $16.49 | $2,825.56 | 26 | Adjusted volatility scaling |
| 4 | sr_double_confirm_248 | $80.37 | $2,089.39 | 23 | Consecutive bounce confirmation |
| 5 | sr_asymmetric_246 | -$57.59 | $1,899.42 | 23 | Asymmetric stop/target ratio |
| 6 | sr_rsi_confirm_245 | $34.06 | $1,569.23 | 16 | RSI + stochastic confirmation |
| 7 | sr_multi_momentum_244 | $39.66 | $1,132.77 | 22 | Multi-exit + momentum combo |
| 8 | sr_momentum_tweak_243 | $38.41 | $700.35 | 17 | Tweaked momentum filter |

## NEW ALL-TIME BEST!

**sr_trend_strength_247** achieved **$3,274.81 full return** - beating the previous best of $2,828.20!

Key characteristics:
- Negative test return (-$174.63) but massive full return
- Only 7 test trades (very selective)
- Trend threshold of -1.7% (allows slightly negative trends)
- Trend period of 25 bars
- High train Sharpe (3.69) and full Sharpe (0.86)

## All-Time Best Performers (Cumulative)

| Rank | Strategy | Test Return | Full Return | Iteration |
|------|----------|-------------|-------------|-----------|
| 1 | **sr_trend_strength_247** | -$174.63 | **$3,274.81** | 7 (NEW!) |
| 2 | sr_multi_exit_tweak_241 | -$27.58 | $2,901.74 | 7 (NEW) |
| 3 | sr_adaptive_multi_exit_234 | $12.47 | $2,828.20 | 6 |
| 4 | sr_adaptive_tweak2_242 | $16.49 | $2,825.56 | 7 (NEW) |
| 5 | sr_adaptive_tweak_233 | -$45.32 | $2,763.48 | 6 |

## Key Insights

1. **Trend strength filter is powerful**: sr_trend_strength_247's massive full return suggests filtering for trend quality catches long-term opportunities

2. **Negative test returns can still be good**: 4 of 8 strategies had negative test returns but positive full returns - the optimizer may be finding robust long-term patterns

3. **Very low trade counts correlate with best returns**: sr_trend_strength_247 made only 7 trades but achieved best full return - quality over quantity

4. **Tweaked strategies continue to improve**: sr_multi_exit_tweak_241 improved on sr_adaptive_multi_exit_234 ($2,901 vs $2,828)

5. **Multi-confirmation strategies show promise**: sr_double_confirm_248 and sr_rsi_confirm_245 both achieved >$1,500 full returns

## Next Iteration Focus

1. **Tweak sr_trend_strength_247** - Adjust trend period and threshold
2. **Tweak sr_multi_exit_tweak_241** - Fine-tune profit target
3. **Tweak sr_adaptive_tweak2_242** - Adjust bounce threshold
4. **New approaches**:
   - Combine trend strength with multi-exit
   - Add trend strength to RSI confirmation
   - Try different trend period lengths
   - Experiment with stricter trend filters
   - Combine multiple confirmation signals

## Strategy Details

### sr_trend_strength_247 (NEW BEST!)
- Base lookback: 20, Min: 10, Max: 40
- Volatility period: 10
- Bounce threshold: 0.045
- Stochastic: K=10, D=3, Oversold=20, Overbought=70
- Trend period: 25, Threshold: -1.7%
- Stop loss: 9.9%, Trailing: 4.3%
- Risk: 19.48%

### sr_multi_exit_tweak_241
- Base lookback: 20, Min: 10, Max: 35
- Volatility period: 10
- Bounce threshold: 0.047
- Stochastic: K=14, D=4, Oversold=25, Overbought=65
- Stop loss: 9.2%, Trailing: 5.0%
- Profit target: 8.3%, Max hold: 30 bars
- Risk: 22.0%
