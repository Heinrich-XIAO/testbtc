# ITERATION 26 - Entry/Exit Logic Variants

## Summary

Tested 10 new strategies with distinct logic changes around the 362 base (max_lookback=50).

**NEW WINNER: 385 (Retest)** - Improves large dataset by 5% while matching on small.

## Strategy Summary Table

| # | Strategy | Logic Change | Small Return | Large Return | vs 362 Small | vs 362 Large | Status |
|---|----------|--------------|--------------|--------------|--------------|--------------|--------|
| 384 | Stoch Turn | Require K turning up from oversold | $1109 | $1963 | = | +2% | ✓ Better |
| 385 | Retest | Require double bottom (support retest) | $1109 | $2027 | = | +5% | ✅ **WINNER** |
| 386 | Mom Exit | Exit when momentum turns negative | $609 | $892 | -45% | -54% | ❌ |
| 387 | Weighted Support | Weighted average of support levels | $320 | $504 | -71% | -74% | ❌ |
| 388 | Stoch Cross Exit | Exit on K/D bearish crossover | $741 | $824 | -33% | -57% | ❌ |
| 389 | Support Strength | Score support by bounce count | $0 | - | -100% | - | ❌ |
| 390 | Vol Sized | Scale position by volatility | $1997 | $1542 | +80% | -20% | ❌ Overfits |
| 391 | Price Action | Require close > prev high | $1109 | $1927 | = | = | = Same |
| 392 | Minimal Exit | Only stop loss + resistance exits | $1433 | $1229 | +29% | -36% | ❌ Overfits |
| 393 | Clustered Support | Find clustered support zones | $800 | $635 | -28% | -67% | ❌ |

## Baseline Comparisons

| Strategy | Small Return | Large Return |
|----------|--------------|--------------|
| **385 (NEW WINNER)** | **$1109** | **$2027** |
| 362 (prev winner) | $1109 | $1927 |
| 302 (base) | $1046 | $1737 |

## Key Findings

1. **385 (Retest) beats 362 on large dataset**: +5% improvement ($2027 vs $1927) while matching on small ($1109). Requires support to be tested twice within 15 bars at similar price level (within 2%).

2. **384 (Stoch Turn) also improves large**: +2% on large while matching small. Requires stochastic K to be rising from oversold.

3. **390 and 392 overfit badly**: Great on small (+80%, +29%) but worse on large (-20%, -36%). These logic changes don't generalize.

4. **Support Strength (389) produces zero trades**: The bounce count requirement was too restrictive.

5. **Price Action (391) identical to 362**: The `close > prevHigh` requirement was already implicitly satisfied by the existing conditions.

## Best Strategy: 385 (Retest)

**Logic**: Require support retest within 15 bars at similar price level (within 2%) before entry.

**Performance**:
- Small: $1109 (66% win, 107 trades)
- Large: $2027 (69.7% win, 893 trades) 

**Key parameters**:
- max_lookback: 50
- retest_bars: 15
- retest_threshold: 0.02
- stoch_k_period: 18

## Next Iteration Ideas

1. Fine-tune 385's retest_bars and retest_threshold parameters
2. Combine 384 (Stoch Turn) + 385 (Retest) logic
3. Test if 385's improvement holds across different time periods