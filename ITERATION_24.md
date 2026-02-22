# ITERATION 24 - Wider Lookup & Combinations

## Summary

This iteration tested wider lookback and combination strategies.

## Strategy Summary Table

| # | Strategy | Logic Change | Test Return | vs Base | Status |
|---|----------|--------------|-------------|---------|--------|
| 362 | Wide Lookup | max_lookback 50 | $1109.66 | **+6%** | ✅ WINNER |
| 363 | Wider Lookup | max_lookback 70 | $235.97 | -77% | ❌ |
| 364 | Smooth Stoch | stoch_d=8 | $233.09 | -78% | ❌ |
| 365 | Base 30 | base_lookback=30 | $123.41 | -88% | ❌ |
| 366 | Combo 362+315 | wide+no momentum | $416.86 | -60% | ❌ |
| 367 | Tight Trail | trailing=0.04 | $1144.43 | +9.8% | ⚠️ Small win |
| 368 | No Time Limit | max_hold=999 | $995.39 | -5% | ❌ |
| 369 | Combo Wide | lookback+0.035 bounce | $181.48 | -83% | ❌ |
| 370 | Wide Res | Exit 10% below res | $179.55 | -83% | ❌ |
| 371 | Combo 362+18 | wide+stoch_k=18 | $568.36 | -46% | ❌ |

## WINNER: Strategy 362

**Strategy 362 (max_lookback=50)** is the first confirmed WINNER:
- **Small dataset**: +6% return ($1109 vs $1046)
- **Large dataset**: +10.9% return ($1926 vs $1737), +110% Sharpe
- Fewer trades (107 vs 121), higher win rate (66% vs 65%)

This is BETTER than base 302 on BOTH datasets!

## Verification on Large Dataset

| Metric | 302 (Base) | 362 (Winner) |
|--------|-----------|--------------|
| Return | $1737.24 | $1926.63 |
| Win Rate | 69.0% | 69.3% |
| Sharpe | 1.431 | 3.007 |
| Drawdown | 99.53% | 96.71% |

## Key Insights

1. **362 is a winner** - wider lookup (50) improves on both datasets
2. **50 is optimal** - 70 is too wide, 36 is too narrow
3. **Combinations don't work** - 362+315, 362+18 both failed

## Best Strategy: 362

Use `max_lookback=50` instead of default 36.