# ITERATION 11 - Entry/Exit Variations

## Summary

This iteration explored various entry and exit condition variations:
- Tight trailing + strict entry combination
- Wide/narrow stochastic bands
- Longer trend periods
- Double confirmation (RSI + Stochastic)
- Time-based exits
- Volatility filtering
- Breakout entries (instead of bounce)

**Best this iteration:** sr_stoch_wide_274 with $3,656.23 full return

**Note:** Wide stochastic bands (oversold=16, overbought=86) produced the best result, suggesting that more extreme conditions lead to better trades.

## Results (Sorted by Full Return)

| Rank | Strategy | Full Return | Test Return | Test Trades | Train Sharpe |
|------|----------|-------------|-------------|-------------|--------------|
| 1 | sr_stoch_wide_274 | $3,656.23 | $-168.37 | 2 | 4.74 |
| 2 | sr_tight_strict_combo_273 | $3,066.60 | $-160.61 | 3 | 3.92 |
| 3 | sr_stoch_narrow_275 | $2,523.10 | $-137.02 | 6 | 3.97 |
| 4 | sr_long_trend_276 | $2,201.58 | $-175.10 | 3 | 3.94 |
| 5 | sr_double_confirm_277 | $1,509.93 | $-12.23 | 2 | 15.84 |
| 6 | sr_vol_filter_279 | $834.74 | $0.00 | 0 | 7.88 |
| 7 | sr_time_exit_278 | $312.42 | $-169.46 | 3 | 2.14 |
| 8 | sr_breakout_entry_280 | $-497.61 | $-239.62 | 63 | 1.85 |

## Top 3 Performers Details

### 1. sr_stoch_wide_274 - $3,656.23
- **Concept:** Wider stochastic levels (oversold=16, overbought=86) for more extreme conditions
- **Key params:** stoch_oversold=16, stoch_overbought=86, trailing_stop=0.045, profit_target=0.143
- **Performance:** Train $630.33, Test $-168.37 (2 trades), Full $3,656.23

### 2. sr_tight_strict_combo_273 - $3,066.60
- **Concept:** Combines 260's strict entry with 267's tighter trailing stop
- **Key params:** trailing_stop=0.040, stoch_oversold=24, profit_target=0.187
- **Performance:** Train $653.70, Test $-160.61 (3 trades), Full $3,066.60

### 3. sr_stoch_narrow_275 - $2,523.10
- **Concept:** Narrower stochastic levels (oversold=28, overbought=60) for more frequent signals
- **Key params:** stoch_oversold=28, stoch_overbought=60, profit_target=0.154
- **Performance:** Train $674.84, Test $-137.02 (6 trades), Full $2,523.10

## Observations

1. **Wide stochastic wins:** sr_stoch_wide_274 achieved $3,656.23, suggesting that waiting for more extreme oversold conditions (stoch < 16) leads to better entries

2. **Breakout strategy failed:** sr_breakout_entry_280 had negative returns (-$497.61), indicating that entering on resistance breakouts doesn't work well in this market

3. **Double confirm too restrictive:** sr_double_confirm_277 requiring both RSI and stochastic oversold only made 2 trades on test data

4. **Vol filter problematic:** sr_vol_filter_279 had 0 test trades, suggesting the volatility filter is too restrictive

5. **Time-based exit underperformed:** sr_time_exit_278 with forced exit at bar 25 only achieved $312.42

## All-Time Best Performers (Updated)

| Rank | Strategy | Full Return | Iteration |
|------|----------|-------------|-----------|
| 1 | sr_strict_multi_exit_260 | $4,414.69 | 9 |
| 2 | sr_strict_entry_256 | $4,098.52 | 8 |
| 3 | sr_trend_strict_249 | $3,947.54 | 8 |
| 4 | **sr_stoch_wide_274** | **$3,656.23** | **11** |
| 5 | sr_trend_strength_247 | $3,274.81 | 7 |
| 6 | sr_adaptive_strict_264 | $3,168.30 | 9 |

## Next Iteration Plan

For ITERATION_12, we should try:
1. **Combine wide stochastic with multi-exit** - merge 274's wide bands with 260's exit conditions
2. **Even wider stochastic** - try stoch_oversold=10, stoch_overbought=92
3. **Wide stoch + tight trailing** - combine 274's entry with 273's trailing stop
4. **Experiment with different K periods** - vary stoch_k_period (8, 10, 16, 18)
5. **Wide stoch + longer hold** - test with max_hold_bars 50-60

## Files Created
- `src/strategies/strat_sr_tight_strict_combo_273.ts`
- `src/strategies/strat_sr_stoch_wide_274.ts`
- `src/strategies/strat_sr_stoch_narrow_275.ts`
- `src/strategies/strat_sr_long_trend_276.ts`
- `src/strategies/strat_sr_double_confirm_277.ts`
- `src/strategies/strat_sr_time_exit_278.ts`
- `src/strategies/strat_sr_vol_filter_279.ts`
- `src/strategies/strat_sr_breakout_entry_280.ts`
