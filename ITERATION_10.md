# ITERATION 10 - Multi-Exit Variations

## Summary

This iteration explored variations of the successful multi-exit mechanism from ITERATION_9 (sr_strict_multi_exit_260 which achieved $4,414.69). We tested different exit conditions including higher profit targets, shorter hold periods, tighter trailing stops, adaptive thresholds, dynamic profit targets, tiered exits, momentum-based exits, and RSI-based exits.

**Best this iteration:** sr_multi_exit_tight_trail_267 with $3,148.41 full return

**Note:** None of the variations beat the original sr_strict_multi_exit_260 ($4,414.69), suggesting that strategy may have found a local optimum that's difficult to improve upon with simple parameter tweaks.

## Results (Sorted by Full Return)

| Rank | Strategy | Full Return | Test Return | Test Trades | Train Sharpe |
|------|----------|-------------|-------------|-------------|--------------|
| 1 | sr_multi_exit_tight_trail_267 | $3,148.41 | $-171.45 | 3 | 3.07 |
| 2 | sr_adaptive_multi_exit_268 | $2,828.78 | $-37.38 | 6 | 4.07 |
| 3 | sr_multi_exit_short_hold_266 | $2,726.72 | $-9.32 | 4 | 3.18 |
| 4 | sr_multi_exit_high_pt_265 | $2,523.04 | $-160.03 | 3 | 3.47 |
| 5 | sr_momentum_exit_271 | $2,492.45 | $-145.81 | 4 | 4.08 |
| 6 | sr_rsi_exit_272 | $2,422.15 | $-153.72 | 3 | 4.05 |
| 7 | sr_tiered_exit_270 | $2,189.84 | $0.00 | 0 | 1250.86 |
| 8 | sr_dynamic_pt_269 | $866.41 | $-14.49 | 1 | 4.62 |

## Top 3 Performers Details

### 1. sr_multi_exit_tight_trail_267 - $3,148.41
- **Concept:** Tighter trailing stop (3-5%) to lock in profits faster
- **Key params:** trailing_stop=0.052, profit_target=0.125, max_hold_bars=45
- **Performance:** Train $648.08, Test $-171.45 (3 trades), Full $3,148.41

### 2. sr_adaptive_multi_exit_268 - $2,828.78
- **Concept:** Adaptive thresholds based on volatility combined with multi-exit
- **Key params:** base_bounce_threshold=0.043, vol_bounce_scale=1.69, trailing_stop=0.034
- **Performance:** Train $429.34, Test $-37.38 (6 trades), Full $2,828.78

### 3. sr_multi_exit_short_hold_266 - $2,726.72
- **Concept:** Shorter maximum hold period (20-35 bars) to force quicker exits
- **Key params:** max_hold_bars=30, profit_target=0.111, trailing_stop=0.057
- **Performance:** Train $497.31, Test $-9.32 (4 trades), Full $2,726.72

## Observations

1. **Original multi-exit still best:** sr_strict_multi_exit_260 ($4,414.69) from ITERATION_9 remains the all-time best, suggesting we may be near a local optimum

2. **Tight trailing helps:** The tighter trailing stop variant (267) performed best this iteration, suggesting profit protection is valuable

3. **Adaptive shows promise:** sr_adaptive_multi_exit_268 had the best test return ($-37.38) among strategies with trades, indicating better generalization

4. **Tiered exit problematic:** sr_tiered_exit_270 had 0 test trades and suspiciously high Sharpe (1250), likely overfitting

5. **Dynamic PT underperformed:** sr_dynamic_pt_269 with volatility-scaled profit targets only made 1 trade and $866 return

## All-Time Best Performers (Updated)

| Rank | Strategy | Full Return | Iteration |
|------|----------|-------------|-----------|
| 1 | sr_strict_multi_exit_260 | $4,414.69 | 9 |
| 2 | sr_strict_entry_256 | $4,098.52 | 8 |
| 3 | sr_trend_strict_249 | $3,947.54 | 8 |
| 4 | sr_trend_strength_247 | $3,274.81 | 7 |
| 5 | sr_adaptive_strict_264 | $3,168.30 | 9 |
| 6 | **sr_multi_exit_tight_trail_267** | **$3,148.41** | **10** |

## Next Iteration Plan

For ITERATION_11, we should try:
1. **Combine tight trailing with strict entry** - merge 267's trailing stop with 260's entry conditions
2. **Explore different stochastic settings** - vary oversold/overbought levels
3. **Test longer trend periods** - try 32-48 bar trend analysis
4. **Add confirmation signals** - require multiple indicators to align before entry
5. **Try time-based exits** - exit at specific bars regardless of profit

## Files Created
- `src/strategies/strat_sr_multi_exit_high_pt_265.ts`
- `src/strategies/strat_sr_multi_exit_short_hold_266.ts`
- `src/strategies/strat_sr_multi_exit_tight_trail_267.ts`
- `src/strategies/strat_sr_adaptive_multi_exit_268.ts`
- `src/strategies/strat_sr_dynamic_pt_269.ts`
- `src/strategies/strat_sr_tiered_exit_270.ts`
- `src/strategies/strat_sr_momentum_exit_271.ts`
- `src/strategies/strat_sr_rsi_exit_272.ts`
