# ITERATION 25 - Fine-tuning & Combinations with 362

## Summary

Tested combinations around winner 362 (max_lookback=50).

## Strategy Summary Table

| # | Strategy | Logic Change | Test Return | vs Base | Status |
|---|----------|--------------|-------------|---------|--------|
| 372 | Lookback 45 | max_lookback=45 | $1119.94 | +7% | ⚠️ Small win |
| 373 | Vol Period 20 | volatility_period=20 | $136.60 | -87% | ❌ |
| 374 | Vol Period 6 | volatility_period=6 | $199.79 | -81% | ❌ |
| 375 | 362+Momentum | +momentum 0.006 | $252.22 | -76% | ❌ |
| 376 | Min Look 20 | min_lookback=20 | $191.47 | -82% | ❌ |
| 377 | Lookback 60 | max_lookback=60 | $217.57 | -79% | ❌ |
| 378 | Lookback 55 | max_lookback=55 | $203.76 | -81% | ❌ |
| 379 | 362+Tight Bounce | bounce=0.020 | $302.38 | -71% | ❌ |
| 380 | 362+Wide Bounce | bounce=0.040 | $181.49 | -83% | ❌ |
| 381 | 362+Def Risk | risk=0.30 | $225.08 | -78% | ❌ |

## Key Findings

1. **372 showed small improvement** on small dataset (+7%) but failed on large
2. **362 remains the winner** - max_lookback=50 is optimal
3. **50 > 45 > 55 > 60 > 70 > 36** - peak around 50

## Best Strategy: 362 (from Iteration 24)

Winner confirmed: `max_lookback=50`
- Small: +6% ($1109 vs $1046)
- Large: +11% ($1926 vs $1737)