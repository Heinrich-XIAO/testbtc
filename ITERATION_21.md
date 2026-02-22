# ITERATION 21 - Additional Indicator Filters

## Summary

This iteration tested 10 additional indicator filters to see if adding more confirmation would improve the base strategy. ALL FAILED.

## Strategy Summary Table

| # | Strategy | Logic Change | Test Return | vs Base | Status |
|---|----------|--------------|-------------|---------|--------|
| 333 | Multi Exit | BE exit at half max bars | $189.46 | -82% | ❌ FAILED |
| 334 | RSI Filter | RSI < 40 required | $26.60 | -97% | ❌ FAILED |
| 335 | EMA Filter | Close > EMA(20) | $11.55 | -99% | ❌ FAILED |
| 336 | Bollinger Filter | Near lower band | -$86.69 | -108% | ❌ FAILED |
| 337 | ATR Filter | ATR < avg * 0.8 | $882.84 | -16% | ❌ FAILED |
| 338 | VWAP Filter | Close < VWAP | $191.47 | -82% | ❌ FAILED |
| 339 | MACD Filter | MACD < signal | $115.70 | -89% | ❌ FAILED |
| 340 | Will%R Filter | %R < -80 | $186.90 | -82% | ❌ FAILED |
| 341 | ADX Filter | ADX < 25 | $337.61 | -68% | ❌ FAILED |
| 342 | ROC Filter | ROC < 0 | $129.62 | -88% | ❌ FAILED |

## Key Insights

1. **Base 302 is highly optimized** - Adding ANY filter hurts performance
2. **Stochastic is sufficient** - Additional oscillators (RSI, MACD, Will%R) are redundant
3. **Support bounce doesn't need trends** - EMA, VWAP, ADX filters hurt
4. **ATR filter was least bad** (-16%) - only one that was close

## Conclusion

All 10 indicator filters failed. The base 302 strategy with its combination of support detection, stochastic, momentum, and bounce is optimal.