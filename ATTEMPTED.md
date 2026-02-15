# ATTEMPTED.md

## Failed Attempts

### RSI Mean Reversion
- **Strategy**: Buy when RSI < oversold, sell when RSI > overbought
- **Result**: 0 trades - RSI requires warmup period that exceeds available data per token
- **Test Return**: $0.00

### ATR Breakout
- **Strategy**: Buy when price breaks above recent high + ATR multiplier
- **Result**: 0 trades - breakout signals too rare with limited data
- **Test Return**: $0.00

### Support/Resistance Bounce
- **Strategy**: Buy when price bounces off support level
- **Test Return**: $1.91
- **Test Sharpe**: -1.2799
- Worse than baseline

### MA + ATR Stop
- **Strategy**: MA crossover with ATR-based trailing stop
- **Test Return**: $0.73
- **Test Sharpe**: 1.0011
- Worse than baseline

### Bollinger Bands (Mean Reversion)
- **Strategy**: Buy when price touches lower band, sell at upper band
- **Parameters**: period=15, std_dev=1.8, stop_loss=1.05%, trailing_stop=true, mean_reversion=true
- **Train Return**: -$28.94 (stdDev: $51.31)
- **Test Return**: $49.40 (stdDev: $147.34)
- **Full Return**: -$51.36 (stdDev: $71.57)
- **Trades**: 7
- **Verdict**: OVERFIT - Test positive but Train/Full negative, only 7 trades, high variance

### Momentum Simple
- **Strategy**: Buy when price momentum exceeds threshold, sell when negative
- **Parameters**: lookback=14, threshold=3%
- **Train Return**: -$51.47 (stdDev: $55.63)
- **Test Return**: -$20.18 (stdDev: $16.04)
- **Full Return**: -$58.19 (stdDev: $41.37)
- **Trades**: 13
- **Verdict**: FAILED - Negative returns across all sets

### Trend Follow
- **Strategy**: Buy on N consecutive up bars, exit on down bar
- **Parameters**: trend_bars=5, stop_loss=8.86%
- **Train Return**: -$3.13 (stdDev: $9.38)
- **Test Return**: -$0.59 (stdDev: $2.21)
- **Full Return**: -$3.72 (stdDev: $11.41)
- **Trades**: 0 (on test set)
- **Verdict**: FAILED - Not enough trades triggered

### Short Term (Price Change)
- **Strategy**: Buy when price change over lookback exceeds threshold
- **Parameters**: lookback=4, entry_threshold=1.07%, stop_loss=7.34%, risk=17.71%
- **Train Return**: -$19.50 (Sharpe: 0.99)
- **Test Return**: -$19.79 (Sharpe: 1.56)
- **Full Return**: -$96.31 (Sharpe: 0.18)
- **Trades**: 108
- **Data**: polymarket-data.bson (sparse: 25 points max per token)
- **Verdict**: FAILED - Negative returns despite positive Sharpe (fee impact)

### ATR Breakout (v2 - Price Range Breakout)
- **Strategy**: Buy when price breaks above recent high + range * multiplier
- **Test Return**: $5.38
- **Trades**: 12
- **Verdict**: FAILED - Barely positive, too few trades, train negative

### MA + Volatility Stop (v2 - StdDev-based)
- **Strategy**: MA crossover with stddev-based trailing stop
- **Test Return**: -$361.76
- **Trades**: 451
- **Verdict**: FAILED - Overfit, too many trades, negative test return

### Momentum (v2 - Trailing Stop)
- **Strategy**: Buy on price momentum, exit on trailing stop with minimum hold
- **Test Return**: -$23.73
- **Trades**: 26
- **Verdict**: FAILED - Negative returns despite trailing stop improvement

### Range Trading (v2)
- **Strategy**: Buy below threshold, sell above threshold (prediction market range)
- **Test Return**: -$207.31
- **Trades**: 31
- **Verdict**: FAILED - Negative returns, range levels too static

### Dual MA with Trend Filter
- **Strategy**: MA crossover with trend MA filter, trailing stop
- **Test Return**: -$52.24
- **Trades**: 37
- **Verdict**: FAILED - Trend filter too restrictive, negative returns

## Successful Attempts

### Simple MA (Current Best) - Time-based Split
- **Strategy**: Fast/Slow MA crossover with fixed stop loss
- **Parameters**: fast=20, slow=25, stop_loss=4.06%, risk=10.16%
- **Train Return**: $565.13 (Sharpe: 1.30)
- **Test Return**: $65.07 (Sharpe: 0.38)
- **Full Return**: $267.20 (Sharpe: 1.23)
- **Trades**: 55
- **Data**: test-data.bson (10 tokens, 738 points each)
- **Split**: Time-based (70% train, 30% test)

### Simple MA (Baseline) - Token-based Split
- **Strategy**: Fast/Slow MA crossover with fixed stop loss
- **Test Return**: $24.54
- **Test Sharpe**: 1.0226
- Previous best with token-based splitting

### Bollinger Bands (v2 - Per-Token Indicators)
- **Strategy**: Mean reversion with per-token SMA/StdDev/RSI Bollinger Bands
- **Test Return**: $3,520.35
- **Trades**: 118
- **Verdict**: PASS but suspicious - may be compounding artifact or overfitting

### RSI Mean Reversion (v2 - Per-Token RSI)
- **Strategy**: Per-token RSI mean reversion, buy oversold / sell overbought
- **Test Return**: $13,631.83
- **Trades**: 334
- **Verdict**: PASS but suspicious - unrealistically high returns

### Support/Resistance (v2)
- **Strategy**: Support bounce with take profit and prediction market bounds
- **Test Return**: $17.88
- **Trades**: 22
- **Verdict**: PASS - Modest but positive

### Mean Reversion (New)
- **Strategy**: Per-token MA-based mean reversion, buy when price below MA by threshold
- **Test Return**: $581.93
- **Trades**: 65
- **Verdict**: PASS - Strong positive returns

## Batch Optimization Round 1 (53 strategies, 2026-02-14)

### Passing Strategies (20 total)

| # | Strategy | Test Return | Trades | Notes |
|---|----------|------------|--------|-------|
| 01 | simple_ma | $65.11 | 55 | Baseline |
| 02 | bollinger | $1,259.43 | 132 | Suspicious high |
| 03 | rsi | $13,310.99 | 320 | Suspicious very high |
| 06 | support | $29.56 | 32 | Modest |
| 09 | mean_revert | $652.75 | 66 | Strong |
| 20 | stoch_fast | $21.37 | 10 | Low trade count |
| 21 | stoch_slow | $322.11 | 21 | Good |
| 22 | willr_short | $614.30 | 161 | Strong |
| 23 | willr_long | $1,036.63 | 63 | Very strong |
| 30 | rsi_div_fast | $53.50 | 36 | Modest |
| 31 | rsi_div_slow | $74.33 | 20 | Modest |
| 32 | mr_rsi_tight | $544.84 | 72 | Strong |
| 33 | mr_rsi_wide | $443.27 | 45 | Strong |
| 38 | env_tight | $426.33 | 72 | Strong |
| 39 | env_wide | $231.64 | 60 | Good |
| 40 | pat_dip | $136.14 | 20 | Good |
| 42 | combo_tight | $103.40 | 70 | Good |
| 43 | combo_wide | $270.31 | 26 | Good |
| 50 | chan_tight | $489.81 | 113 | Strong |
| 51 | chan_wide | $169.32 | 39 | Good |

### Failed Strategies (32 total)

| # | Strategy | Test Return | Trades | Notes |
|---|----------|------------|--------|-------|
| 04 | breakout | $9.87 | 14 | Barely positive, too few trades |
| 05 | ma_vol | -$377.59 | 451 | Overtrading |
| 07 | momentum | -$32.64 | 28 | Negative |
| 08 | range | -$207.31 | 31 | Static levels don't work |
| 10 | dual_ma | -$63.81 | 42 | Trend filter too restrictive |
| 11 | ema_fast | -$52.63 | 65 | EMA cross too noisy |
| 12 | ema_med | -$93.10 | 42 | EMA cross negative |
| 13 | ema_slow | -$142.89 | 42 | Slow EMA too lagging |
| 14 | ema_tight | -$83.30 | 53 | Tight stops triggered too often |
| 15 | ema_wide | $0.00 | 0 | No trades generated |
| 16 | roc_fast | -$188.30 | 92 | ROC too noisy |
| 17 | roc_slow | -$197.08 | 52 | ROC negative |
| 18 | donchian_short | -$122.83 | 44 | Donchian breakout doesn't work |
| 19 | donchian_long | -$64.82 | 34 | Same |
| 24 | accel_fast | -$90.21 | 100 | Price acceleration too noisy |
| 25 | accel_slow | -$89.94 | 169 | Same |
| 26 | vbreak_tight | $0.00 | 0 | No trades - vol contraction never detected |
| 27 | vbreak_wide | $0.00 | 0 | Same |
| 28 | ribbon_tight | -$81.93 | 34 | MA ribbon signals poor |
| 29 | ribbon_wide | -$43.96 | 24 | Same |
| 34 | adapt_fast | -$160.10 | 197 | Adaptive MA overtrading |
| 35 | adapt_slow | -$168.79 | 129 | Same |
| 36 | tri_ma_fast | $0.00 | 0 | No trades |
| 37 | tri_ma_slow | $0.00 | 0 | No trades |
| 41 | pat_mom | -$3.22 | 6 | Too few signals |
| 44 | tstr_fast | $0.00 | 0 | No trades |
| 45 | tstr_slow | -$0.73 | 3 | Near zero |
| 46 | swing_short | -$80.57 | 47 | Swing detection poor |
| 47 | swing_long | -$105.63 | 25 | Same |
| 48 | rev_fast | -$137.05 | 64 | Reversal signals unreliable |
| 49 | rev_slow | -$107.39 | 86 | Same |
| 52 | mcross_fast | -$116.03 | 111 | Mean cross overtrading |
| 53 | mcross_slow | -$40.90 | 79 | Same |

## Batch Optimization Round 2 - Wave 2 (147 strategies, IDs 54-200, 2026-02-14)

Generated from 7 winning templates: mean_revert_rsi, williams_r, ma_envelope, channel_follow, combo_rsi_bb, stochastic, price_pattern, rsi_divergence.

**Overall: 113 passed, 35 failed**

### Top 20 Performers

| # | Strategy | Test Return | Trades | Template |
|---|----------|------------|--------|----------|
| 84 | willr_v11 | $1,083.84 | 166 | williams_r |
| 104 | env_v11 | $1,067.44 | 62 | ma_envelope |
| 100 | env_v07 | $1,018.88 | 57 | ma_envelope |
| 113 | env_v20 | $999.44 | 39 | ma_envelope |
| 93 | willr_v20 | $878.03 | 63 | williams_r |
| 79 | willr_v06 | $863.11 | 109 | williams_r |
| 130 | chan_v17 | $834.41 | 94 | channel_follow |
| 103 | env_v10 | $818.36 | 41 | ma_envelope |
| 64 | mr_rsi_v11 | $784.76 | 70 | mean_revert_rsi |
| 109 | env_v16 | $775.56 | 57 | ma_envelope |
| 124 | chan_v11 | $773.18 | 114 | channel_follow |
| 143 | combo_v10 | $766.56 | 10 | combo_rsi_bb |
| 78 | willr_v05 | $759.88 | 118 | williams_r |
| 87 | willr_v14 | $756.75 | 162 | williams_r |
| 144 | combo_v11 | $754.40 | 87 | combo_rsi_bb |
| 77 | willr_v04 | $745.38 | 187 | williams_r |
| 97 | env_v04 | $743.54 | 60 | ma_envelope |
| 99 | env_v09 | $728.99 | 44 | ma_envelope |
| 96 | env_v03 | $636.93 | 58 | ma_envelope |
| 106 | env_v13 | $624.82 | 58 | ma_envelope |

### Passing Strategies by Template

**Mean Revert RSI (20/20 passed):** All 20 variants profitable ($92-$785). Best: mr_rsi_v11 ($784.76, 70 trades)

**Williams %R (20/20 passed):** All 20 variants profitable ($158-$1,084). Best: willr_v11 ($1,083.84, 166 trades)

**MA Envelope (17/20 passed):** 17 of 20 variants profitable ($22-$1,067). Best: env_v11 ($1,067.44, 62 trades). Failed: env_v01, env_v15, env_v19

**Channel Follow (19/20 passed):** 19 of 20 variants profitable ($33-$834). Best: chan_v17 ($834.41, 94 trades). Failed: chan_v20 (0 trades)

**Combo RSI+BB (13/20 passed):** 13 of 20 variants profitable ($19-$767). Best: combo_v10 ($766.56, 10 trades). Failed: combo_v07, v12, v13, v15, v16, v17, v20

**Stochastic (19/20 passed):** 19 of 20 variants profitable ($2-$518). Best: stoch_v05 ($518.22, 33 trades). Failed: stoch_v20. Generally low returns and trade counts.

**Price Pattern (0/20 passed):** All 20 variants failed. 7 had 0 trades, 13 had negative returns. Pattern detection doesn't work on this data.

**RSI Divergence (5/7 passed):** 5 of 7 variants profitable ($7-$219). Best: rsi_d_v05 ($219.14, 36 trades). Failed: rsi_d_v03, rsi_d_v07

### Failed Strategies (35 total)

| # | Strategy | Test Return | Trades | Notes |
|---|----------|------------|--------|-------|
| 05 | ma_vol | -$394.24 | 451 | Re-optimized, still overtrading |
| 94 | env_v01 | -$146.09 | 102 | Envelope too narrow |
| 108 | env_v15 | -$135.18 | 98 | Envelope params poor |
| 112 | env_v19 | -$142.38 | 104 | Envelope params poor |
| 133 | chan_v20 | $0.00 | 0 | No trades generated |
| 140 | combo_v07 | $0.00 | 0 | No trades generated |
| 145 | combo_v12 | $0.00 | 0 | No trades generated |
| 146 | combo_v13 | -$12.21 | 62 | Negative |
| 148 | combo_v15 | -$163.37 | 62 | Negative |
| 149 | combo_v16 | -$75.61 | 53 | Negative |
| 150 | combo_v17 | -$222.70 | 21 | Negative |
| 153 | combo_v20 | $0.00 | 0 | No trades generated |
| 173 | stoch_v20 | -$29.18 | 7 | Negative |
| 174-193 | pat_v01-v20 | -$20 to $0 | 0-20 | ALL FAILED - pattern template broken |
| 196 | rsi_d_v03 | -$21.34 | 18 | Negative |
| 200 | rsi_d_v07 | -$11.24 | 18 | Negative |

### Key Insights from Wave 2

1. **Williams %R is the most reliable template** — 100% pass rate, high returns, many trades
2. **Mean Revert RSI also 100% reliable** — all 20 variants passed
3. **MA Envelope and Channel Follow near-perfect** — 85-95% pass rates, some of highest returns
4. **Price Pattern template is completely broken** — 0% pass rate, needs fundamental redesign
5. **Combo RSI+BB is hit-or-miss** — 65% pass rate, some variants produce 0 trades
6. **Stochastic variants pass but with modest returns** — most under $50
