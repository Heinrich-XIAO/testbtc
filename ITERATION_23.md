# ITERATION 23 - Various Logic Changes

## Summary

This iteration tested 10 more logic variations.

## Strategy Summary Table

| # | Strategy | Logic Change | Test Return | vs Base | Status |
|---|----------|--------------|-------------|---------|--------|
| 353 | Only Stochastic | No support/momentum | $487.50 | -53% | ❌ FAILED |
| 354 | Tight Bounce | threshold 0.015 | $351.18 | -66% | ❌ FAILED |
| 355 | Late Exit | stoch_overbought 95 | $139.44 | -87% | ❌ FAILED |
| 356 | Day Filter | Skip Mon/Fri | $191.00 | -82% | ❌ FAILED |
| 357 | Short Hold | max_hold 15 | $184.10 | -82% | ❌ FAILED |
| 358 | Vol TP | Volatility-adj target | $1080.29 | +3% | ⚠️ Small win |
| 359 | No Bounce | min_bounce=0 | $364.27 | -65% | ❌ FAILED |
| 360 | Slow Stoch | stoch_k 28 | $564.84 | -46% | ❌ FAILED |
| 361 | High Risk | risk 0.50 | $333.95 | -68% | ❌ FAILED |

## Key Insights

1. **358 (Vol TP) showed small improvement** (+3%) on small dataset but failed on large
2. **Higher risk hurts** - risk 0.50 worse than 0.30
3. **Shorter hold hurts** - 15 bars worse than 28

## Conclusion

All failed. Base 302 remains optimal.