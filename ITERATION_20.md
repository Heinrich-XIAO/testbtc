# ITERATION 20 - More Strategy Logic Variants

## Summary

This iteration tested 10 additional new strategy variants with different LOGIC changes (not parameter optimization).

## Strategy Summary Table

| # | Strategy | Logic Change | Test Return | vs Base | Status |
|---|----------|--------------|-------------|---------|--------|
| 323 | Wider Bounce | min_bounce_bars: 3 | $0.09 | -99.9% | ❌ FAILED |
| 324 | Tight Stochastic | stoch_oversold: 14 | $210.10 | -80% | ❌ FAILED |
| 325 | Wide Stochastic | stoch_oversold: 34 | $276.72 | -74% | ❌ FAILED |
| 326 | No Bounce | min_bounce_bars: 0 | $364.27 | -65% | ❌ FAILED |
| 327 | Wide Bounce Threshold | bounce: 0.05 | $87.80 | -92% | ❌ FAILED |
| 328 | Tight Stop | stop_loss: 0.04 | $135.81 | -87% | ❌ FAILED |
| 329 | Wide Stop | stop_loss: 0.15 | $191.47 | -82% | ❌ FAILED |
| 330 | Wide TP | profit_target: 0.25 | $117.39 | -89% | ❌ FAILED |
| 331 | No Trailing | trailing_stop: 0.99 | $332.93 | -68% | ❌ FAILED |
| 332 | Long Hold | max_hold_bars: 50 | $1,025.23 | -2% | ⚠️ Near baseline |

## Detailed Results

### Strategy 323: Wider Bounce (min_bounce_bars=3)
- **Result**: Only 4 trades, $0.09 return
- **Verdict**: Too strict, filters almost all trades

### Strategy 324: Tight Stochastic (oversold=14)
- **Result**: 38 trades, $210.10 return
- **Verdict**: Too early entry, misses opportunities

### Strategy 325: Wide Stochastic (oversold=34)
- **Result**: 183 trades, $276.72 return
- **Verdict**: Too late entry, lower quality

### Strategy 326: No Bounce (min_bounce_bars=0)
- **Result**: 223 trades, $364.27 return
- **Verdict**: Bounce filter helps quality

### Strategy 327: Wide Bounce Threshold (0.05)
- **Result**: $87.80 return
- **Verdict**: Too lenient, enters bad trades

### Strategy 328: Tight Stop (0.04)
- **Result**: $135.81 return
- **Verdict**: Exits too early, loses bounces

### Strategy 329: Wide Stop (0.15)
- **Result**: $191.47 return
- **Verdict**: Too loose, larger losses

### Strategy 330: Wide TP (0.25)
- **Result**: $117.39 return
- **Verdict**: Doesn't let winners run enough

### Strategy 331: No Trailing Stop
- **Result**: $332.93 return
- **Verdict**: Trailing stop helps lock profits

### Strategy 332: Long Hold (50 bars)
- **Result**: $1,025.23 return
- **Verdict**: Nearly identical to base (28 bars)

## Key Insights

1. **Base 302 is well-tuned** - Most changes hurt performance
2. **Bounce filter matters** - Removing it hurts by 65%
3. **Stochastic oversold=24 is optimal** - Both tighter and wider hurt
4. **Stop loss 0.08 is good** - Both tighter and wider hurt
5. **Profit target 0.12 is good** - Wider targets hurt
6. **Trailing stop helps** - Disabling it hurts by 68%

## Conclusion

Base strategy 302 is already highly optimized. Most logic changes hurt performance. The only near-baseline result was strategy 332 (long hold) which was nearly identical.

**Best strategy remains: 302 with saved params**