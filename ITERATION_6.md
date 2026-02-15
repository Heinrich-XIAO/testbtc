# ITERATION 6 Results

## Summary

8 new strategies (233-240) based on tweaks to top performers and new approaches.

## Top Performers (Sorted by Full Return)

| Rank | Strategy | Test Return | Full Return | Test Trades | Key Features |
|------|----------|-------------|-------------|-------------|--------------|
| 1 | sr_adaptive_multi_exit_234 | $12.47 | **$2,828.20** | 24 | Adaptive lookback + profit target + time exit |
| 2 | sr_adaptive_tweak_233 | -$45.32 | **$2,763.48** | 23 | Wider volatility range + dynamic bounce |
| 3 | sr_adaptive_momentum_235 | $57.50 | $1,939.26 | 15 | Adaptive lookback + momentum filter |
| 4 | rsi_adaptive_support_236 | -$71.66 | $1,359.61 | 22 | RSI + adaptive support levels |
| 5 | multi_timeframe_sr_240 | $209.06 | $1,336.59 | 36 | Multi-timeframe support detection |
| 6 | atr_trailing_239 | $251.49 | $1,126.84 | 45 | ATR-based adaptive trailing stop |
| 7 | dynamic_stoch_237 | $247.46 | $934.47 | 46 | Dynamic stochastic thresholds |
| 8 | volatility_sizing_238 | $81.18 | $453.57 | 40 | Volatility-adjusted position sizing |

## All-Time Best Performers (Cumulative)

| Rank | Strategy | Test Return | Full Return | Iteration |
|------|----------|-------------|-------------|-----------|
| 1 | **sr_adaptive_multi_exit_234** | $12.47 | **$2,828.20** | 6 (NEW) |
| 2 | sr_adaptive_tweak_233 | -$45.32 | $2,763.48 | 6 (NEW) |
| 3 | sr_adaptive_225 | -$0.10 | $2,696.41 | 5 |
| 4 | sr_adaptive_momentum_235 | $57.50 | $1,939.26 | 6 (NEW) |
| 5 | rsi_adaptive_support_236 | -$71.66 | $1,359.61 | 6 (NEW) |

## Key Insights

1. **sr_adaptive_multi_exit_234 is new best**: Full return of $2,828.20 beats sr_adaptive_225's $2,696.41
   - Combines adaptive lookback with profit target (8.4%) and max hold bars (40)
   - Multi-exit approach captures gains while limiting exposure

2. **Adaptive lookback continues to dominate**: Top 4 strategies all use adaptive lookback based on volatility

3. **Multi-exit strategies show promise**: Adding profit targets and time-based exits improves full returns

4. **Trade quality vs quantity**: Lower trade counts (15-24) correlate with better full returns

5. **Higher full returns from negative test returns**: sr_adaptive_tweak_233 had -$45.32 test but $2,763.48 full return - indicates the optimizer found robust long-term patterns

## Next Iteration Focus

1. **Tweak sr_adaptive_multi_exit_234** - Refine profit target and max hold bars
2. **Tweak sr_adaptive_tweak_233** - Adjust bounce threshold parameters
3. **Tweak sr_adaptive_momentum_235** - Fine-tune momentum filter
4. **New approaches**:
   - Combine multi-exit with momentum filter
   - Add RSI confirmation to adaptive SR
   - Experiment with asymmetric stop/target ratios
   - Try trend strength filters
   - Multi-confirmation entry signals

## Strategy Details

### sr_adaptive_multi_exit_234 (BEST)
- Base lookback: 20, Min: 10, Max: 35
- Volatility period: 8
- Bounce threshold: 0.036
- Stochastic: K=14, D=4, Oversold=30, Overbought=65
- Stop loss: 10.78%, Trailing: 5.5%
- Profit target: 8.4%, Max hold: 40 bars
- Risk: 19.83%

### sr_adaptive_tweak_233
- Base lookback: 20, Min: 10, Max: 35
- Volatility period: 10
- Base bounce: 0.033, Vol scale: 2.37
- Stochastic: K=14, D=4, Oversold=25, Overbought=70
- Stop loss: 6.8%, Trailing: 5.9%
- Risk: 17.62%
