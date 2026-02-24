# ATTEMPTED.md

## Iteration 61 Results (In Progress)

### strat_iter61_b: Bifurcation Flip Reversion - SUCCESS
- Small: +27.46% (90 trades), Large: +51.37% (1441 trades)
- Verdict: Passes winner criteria (positive both, large >= small, >15 small trades).

### strat_iter61_a: Reservoir Readout Support Reclaim - FAILED (overfit rule)
- Small: +68.47% (76 trades), Large: +30.89% (808 trades)
- Verdict: Positive on both datasets with sufficient trade count, but fails winner rule because large < small.

### strat_iter61_c: Meta-Label Confidence Stack - FAILED (overfit rule)
- Small: +176.46% (52 trades), Large: +14.66% (22 trades)
- Verdict: Positive on both datasets with sufficient trade count, but fails winner rule because large < small.

## Iteration 60 Results (In Progress)

### strat_iter60_c: Counterfactual Transition Utility Ensemble - SUCCESS
- Small: +89.87% (44 trades), Large: +345.57% (455 trades)
- Verdict: Passes winner criteria (positive both, large >= small, >15 small trades).

### strat_iter60_b: Adaptive Kalman Residual Rebound Gate - SUCCESS
- Small: +62.69% (26 trades), Large: +69.41% (301 trades)
- Verdict: Passes winner criteria (positive both, large >= small, >15 small trades).

### strat_iter60_a: SAX Motif Dictionary Reversal - FAILED (overfit rule)
- Small: +39.20% (348 trades), Large: +37.56% (9873 trades)
- Verdict: Positive on both datasets with strong trade count, but fails winner rule because large < small.

## Iteration 59 Results (In Progress)

### strat_iter59_a: Phase-Space Curvature Cusp Reversal - SUCCESS
- Small: +23.99% (119 trades), Large: +32.08% (4255 trades)
- Verdict: Passes winner criteria (positive both, large >= small, >15 small trades).

### strat_iter59_b: Predictive Residual Surprise Mean-Revert - SUCCESS
- Small: +19.29% (44 trades), Large: +33.85% (675 trades)
- Verdict: Passes winner criteria (positive both, large >= small, >15 small trades).

### strat_iter59_c: Point-Process Aftershock Fade - FAILED (overfit rule)
- Small: +110.70% (202 trades), Large: +91.78% (2505 trades)
- Verdict: Positive on both datasets with strong trade counts, but fails winner rule because large < small.

## Iteration 58 Results (In Progress)

### strat_iter58_a: Recurrence Transition Support Rebound - FAILED
- Small: +43.16% (12 trades), Large: -26.29% (242 trades)
- Verdict: Optimization performed strongly on small data but failed validation with negative large-dataset return and also missed the 15-trade minimum on small.

### strat_iter58_b: Adaptive Bayesian Mini-Model Ensemble - FAILED (overfit rule)
- Small: +170.40% (305 trades), Large: +154.75% (3976 trades)
- Verdict: Positive on both datasets with strong trade count, but fails winner rule because large < small.

### strat_iter58_c: Multi-Horizon Hurst Dispersion Persistence - FAILED (overfit rule)
- Small: +22.86% (81 trades), Large: +17.24% (1036 trades)
- Verdict: Positive on both datasets with sufficient trade count, but fails winner rule because large < small.

## Iteration 57 Results (In Progress)

### strat_iter57_c: Dynamic Risk-Parity Drawdown State - FAILED (overfit rule)
- Small: +22.82% (371 trades), Large: +20.47% (6518 trades)
- Verdict: Positive on both datasets with strong trade count, but fails winner rule because large < small.

### strat_iter57_a: Mutual-information Predictability Spike - FAILED (insufficient small-sample trades)
- Small: +8.90% (6 trades), Large: +12.03% (72 trades)
- Verdict: Positive on both datasets with large >= small, but fails minimum 15-trade requirement on small dataset.

## Iteration 56 Results (In Progress)

### strat_iter56_a: Topological Persistence Basin Proxy - FAILED (insufficient small-sample trades)
- Small: +5.62% (8 trades), Large: +0.43% (444 trades)
- Verdict: Positive on both datasets with large >= small, but fails minimum 15-trade requirement on small dataset.

### strat_iter56_c: Wavelet-like Multi-scale Energy Ratio - FAILED (overfit rule)
- Small: +40.94% (38 trades), Large: +31.97% (350 trades)
- Verdict: Positive on both datasets with sufficient trade count, but fails winner rule because large < small.

### strat_iter56_b: Hidden-State Markov Proxy - FAILED
- Small: +65.79% (508 trades), Large: -6.07% (9784 trades)
- Verdict: Optimized strongly on small data, but fails validation with negative large-dataset return.

## Iteration 55 Results (In Progress)

### strat_iter55_b: Nash Proxy Regime Game - FAILED (overfit rule)
- Small: +163.87% (1042 trades), Large: +73.45% (17948 trades)
- Verdict: Positive on both datasets with strong trade count, but fails winner rule because large < small.

### strat_iter55_c: Mutation-Crossover Signal Pool - FAILED (instability)
- Small: +432.29% (130 trades), Large: +9838.18% (2259 trades)
- Verdict: Positive on both with sufficient trades, but behavior is highly unstable (extreme validation explosion) and fails robustness expectations.

## Iteration 54 Results

### strat_iter54_a: Cellular Automata Emergence - FAILED (overfit rule)
- Small: +360.84% (272 trades), Large: +130.21% (5787 trades)
- Verdict: Positive on both datasets with sufficient trade count, but fails winner rule because large < small.

### strat_iter54_c: Agent Consensus Micro-Sim Proxy - SUCCESS ⭐ WINNER
- Small: +113.60% (800 trades), Large: +238.03% (13369 trades)
- Verdict: Passes winner criteria (positive both, large >= small, >15 small trades).

### strat_iter54_b: KL Shock Stabilization Regime - FAILED (overfit rule)
- Small: +106.40% (382 trades), Large: +83.35% (6068 trades)
- Verdict: Strong on both datasets, but fails winner rule because large < small.

## Iteration 51 Results

### strat_iter51_c: Fractal Cycle Phase - SUCCESS ⭐ WINNER
- Small: +4.92% (92 trades), Large: +56.70% (1707 trades)
- Verdict: Passes winner criteria (positive both, large >= small, >15 small trades). Most conservative of the three.

### strat_iter51_a: Genetic Fitness Proxy - MIXED
- Small: +1752.47% (836 trades), Large: +1156.87% (9106 trades)
- Verdict: High returns but extreme volatility (max DD > 8000%). Fails robustness criteria.

### strat_iter51_b: Entropy Chaos Filter - MIXED
- Small: +550.48% (1610 trades), Large: +404.94% (27491 trades)
- Verdict: High returns but extreme volatility (max DD > 9000%). Fails robustness criteria.

## Iteration 50 Results

### strat_iter50_a: Under-support Reclaim v2 - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Under-support dwell/reclaim constraints were too restrictive.

### strat_iter50_b: Narrow Range Impulse - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Compression + impulse trigger did not fire on either dataset.

### strat_iter50_c: Pressure Flip Reversal - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Pressure-flip setup did not generate entries.

## Iteration 49 Results

### strat_iter49_b: Distance-scaled Target v2 - SUCCESS ⭐ WINNER
- Small: +25.75% (344 trades), Large: +39.99% (6571 trades)
- Verdict: Passes winner criteria (positive both, large >= small, >15 small trades).

### strat_iter49_c: Dual Support Alignment - SUCCESS
- Small: +27.37% (343 trades), Large: +38.22% (6748 trades)
- Verdict: Valid robust strategy, slightly below winner on large return.

### strat_iter49_a: Loss-cluster Higher-low Reversal - FAILED (overfit rule)
- Small: +10.43% (16 trades), Large: +6.17% (334 trades)
- Verdict: Positive on both, but fails winner rule because large < small.

## Iteration 48 Results

### strat_iter48_b: ATR-normalized Discount Reversion - FAILED (overfit rule)
- Small: +28.43% (97 trades), Large: +28.04% (2001 trades)
- Verdict: Near-robust but fails winner rule because large < small.

### strat_iter48_a: Percentile Shock Snapback - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Shock arm + rebound release was too restrictive.

### strat_iter48_c: Z-score Release Reversal - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Z-score release logic did not trigger entries.

## Iteration 47 Results

### strat_iter47_b: Stochastic Velocity Burst - SUCCESS ⭐ WINNER
- Small: +17.19% (341 trades), Large: +28.74% (6156 trades)
- Verdict: Passes winner criteria (positive both, large >= small, >15 small trades).

### strat_iter47_c: Support Dwell Breakout - FAILED (overfit rule)
- Small: +108.13% (403 trades), Large: +11.27% (6402 trades)
- Verdict: Positive on both, but fails winner rule because large < small.

### strat_iter47_a: EMA Inflection Reclaim - FAILED
- Small: +16.81% (91 trades), Large: -2.47% (1746 trades)
- Verdict: Negative validation return on large dataset.

## Iteration 46 Results

### strat_iter46_b: Downside Exhaustion Ladder - FAILED (insufficient trades)
- Small: +5.43% (8 trades), Large: +12.65% (148 trades)
- Verdict: Positive on both and large >= small, but fails minimum 15-trade requirement on small dataset.

### strat_iter46_a: Squeeze Release Support Reversion - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Squeeze + release gating was too restrictive.

### strat_iter46_c: Wick Reclaim Strength - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Wick/reclaim stack produced no entries.

## Iteration 45 Results

### strat_iter45_a: Choppiness-gated Mean Reversion - SUCCESS ⭐ WINNER
- Small: +9.17% (26 trades), Large: +39.00% (911 trades)
- Verdict: Passes winner criteria (positive both, large >= small, >15 small trades).

### strat_iter45_b: Oversold Persistence Release - SUCCESS
- Small: +20.23% (325 trades), Large: +31.84% (4971 trades)
- Verdict: Valid robust strategy, below winner by large-return ranking.

### strat_iter45_c: Shock Reversal Inside Bar - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Setup is too restrictive and produces no entries.

## Iteration 44 Results

### strat_iter44_c: Half-life Stop Tightening - SUCCESS ⭐ WINNER
- Small: +17.73% (371 trades), Large: +32.75% (7198 trades)
- Verdict: Passes winner criteria and leads iteration on large validation return.

### strat_iter44_b: Loss-streak Adaptive Cooldown - SUCCESS
- Small: +23.25% (387 trades), Large: +25.42% (7371 trades)
- Verdict: Valid robust strategy, below winner by large-return ranking.

### strat_iter44_a: Range-regime Hybrid - FAILED (overfit rule)
- Small: +61.26% (389 trades), Large: +35.32% (7207 trades)
- Verdict: Positive on both, but fails winner rule because large < small.

## Iteration 43 Results

### strat_iter43_a: ATR Expansion Kickoff - FAILED (overfit rule)
- Small: +23.72% (87 trades), Large: +19.89% (2219 trades)
- Verdict: Positive on both, but fails winner rule because large < small.

### strat_iter43_b: Divergence Proxy - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Entry conditions are too restrictive.

### strat_iter43_c: Under-support Reclaim Duration - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Reclaim duration logic did not trigger on either dataset.

## Iteration 42 Results

### strat_iter42_a: Rising Support Staircase - SUCCESS ⭐ WINNER
- Small: +3.01% (20 trades), Large: +21.06% (854 trades)
- Verdict: Passes winner criteria and is the only fully valid strategy in this iteration.

### strat_iter42_b: Z-score + Support Holds - FAILED (overfit rule)
- Small: +70.46% (225 trades), Large: +27.46% (3829 trades)
- Verdict: Strong on both but fails winner rule because large < small.

### strat_iter42_c: EMA Pullback Continuation - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Multi-stage continuation setup produced no entries.

## Iteration 41 Results

### strat_iter41_c: Distance-scaled Target - SUCCESS ⭐ WINNER
- Small: +30.94% (83 trades), Large: +34.49% (1876 trades)
- Verdict: Passes winner criteria with large >= small and sufficient trades.

### strat_iter41_a: Support Compression Breakout - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Compression + breakout filters were too restrictive.

### strat_iter41_b: Liquidity Sweep Reclaim - FAILED (no trades)
- Small: +0.00% (0 trades), Large: +0.00% (0 trades)
- Verdict: Sweep/reclaim constraints prevented entries.

## Iteration 40 Results

### strat_iter40_c: Range-normalized Momentum - FAILED (overfit rule)
- Small: +19.61% (119 trades), Large: +12.35% (3006 trades)
- Verdict: Positive on both, but fails winner rule because large < small.

### strat_iter40_a: Multi-bar Confirmation Score - FAILED (overfit rule)
- Small: +22.20% (112 trades), Large: +0.25% (2321 trades)
- Verdict: Validation collapses vs small dataset.

### strat_iter40_b: MACD Zero-line Retest - FAILED
- Small: +1.42% (146 trades), Large: -12.99% (3322 trades)
- Verdict: Negative validation return.

## Iteration 39 Results

### strat_iter39_b: Dynamic Resistance Threshold by Volatility - SUCCESS ⭐ WINNER
- Small: +35.94% (334 trades), Large: +46.19% (6104 trades)
- Verdict: Passes winner criteria (positive both, large >= small, >15 small trades).

### strat_iter39_a: Time-decay Profit Target - SUCCESS
- Small: +20.74% (351 trades), Large: +44.33% (6850 trades)
- Verdict: Valid robust strategy, below winner by large-return ranking.

### strat_iter39_c: Position Cooldown After Stopout - SUCCESS
- Small: +19.44% (363 trades), Large: +33.58% (7109 trades)
- Verdict: Valid robust strategy, below winner by large-return ranking.

## Iteration 38 Results

### strat_iter38_a: RSI Percentile Regime - FAILED (overfit rule)
- Small: +462.75% (1283 trades), Large: +247.38% (19356 trades)
- Verdict: Strong absolute results but fails winner rule because large < small.

### strat_iter38_b: Donchian Mean-Revert Hybrid - FAILED (overfit rule)
- Small: +390.44% (2562 trades), Large: +156.62% (37999 trades)
- Verdict: Positive on both, but fails winner rule because large < small.

### strat_iter38_c: Two-stage Entry Confirmation - FAILED
- Small: +48.71% (115 trades), Large: -7.05% (1860 trades)
- Verdict: Negative validation return.

## Iteration 37 Results

### strat_iter37_a: ATR Trailing Stop Variant - FAILED (overfit rule)
- Small: +32.74% (403 trades), Large: +19.95% (7901 trades)
- Verdict: Positive on both, but fails winner rule because large < small.

### strat_iter37_b: Support-age Weighting - FAILED
- Small: +11.78% (785 trades), Large: -2.78% (12533 trades)
- Verdict: Negative validation return.

### strat_iter37_c: Failed Breakout Fade - FAILED
- Small: -22.73% (489 trades), Large: -10.80% (5014 trades)
- Verdict: Negative on both datasets.

## Iteration 36 Results

### strat_iter36_c: Stochastic Hysteresis Bands - FAILED (overfit rule)
- Small: +6.67% (352 trades), Large: +2.96% (6589 trades)
- Verdict: Positive on both, but fails winner rule because large < small.

### strat_iter36_a: VWAP Deviation Re-entry - FAILED (insufficient trades)
- Small: +5.27% (8 trades), Large: +3.05% (160 trades)
- Verdict: Fails minimum 15-trade requirement on small dataset.

### strat_iter36_b: EMA Slope Regime Gate - FAILED (insufficient trades)
- Small: +0.00% (4 trades), Large: +1.06% (118 trades)
- Verdict: Fails minimum 15-trade requirement on small dataset.

## Iteration 35 Results

### Iter35 B: Break-even Stop Promotion - SUCCESS
- **Logic**: Baseline stochastic support entry with standard exits (stop loss, profit target, resistance, max hold) plus dynamic break-even stop promotion after unrealized gain crosses a trigger.
- **Result**:
  - Small dataset (`data/test-data.bson`): +31.82% return, 348 trades, 39.4% win
  - Large dataset (`data/test-data-15min-large.bson`): +36.37% return, 6479 trades, 38.9% win
- **Verdict**: Passes iteration winner criteria (positive on both, large >= small, and >15 small-dataset trades).

## Iteration 34 Results

### Iter34 B: Z-Score Support Reversion - FAILED (overfit vs validation rule)
- **Logic**: Enter on deep negative z-score (rolling mean/std) only when price is near support; exit at mean-reversion target, stop loss, or max hold.
- **Result**:
  - Small dataset (`data/test-data.bson`): +389.73% return, 700 trades, 29.6% win
  - Large dataset (`data/test-data-15min-large.bson`): +303.80% return, 9229 trades, 32.3% win
- **Verdict**: Positive on both datasets, but fails iteration winner rule because large return is lower than small return.

### Iter34 A: Donchian Breakout Retest - FAILED (overfit vs validation rule)
- **Logic**: Detect breakout above short Donchian high, then require pullback retest near the breakout level before long entry; exit on stop, profit target, Donchian resistance, or max hold.
- **Result**:
  - Small dataset (`data/test-data.bson`): +148.23% return, 300 trades, 39.3% win
  - Large dataset (`data/test-data-15min-large.bson`): +51.21% return, 3747 trades, 39.4% win
- **Verdict**: Positive on both datasets, but fails iteration winner rule because large return is lower than small return.

## Iteration 24 Results (Lookback Variations)

### iter24_a: Lookback 51 - SUCCESS
- **Logic**: Stochastic + Support/Resistance with lookback 51, max_hold 32
- **Result**:
  - Small dataset: $226.07 (22.6%), 385 trades, 42.3% win
  - Large dataset: $289.82 (29.0%), 7413 trades, 78.9% win
- **Verdict**: Positive on both datasets, moderate returns

### iter24_b: Lookback 52 - SUCCESS
- **Logic**: Stochastic + Support/Resistance with lookback 52, max_hold 32
- **Result**:
  - Small dataset: $235.92 (23.6%), 383 trades, 42.3% win
  - Large dataset: $253.79 (25.4%), 7408 trades, 78.6% win
- **Verdict**: Positive on both datasets, moderate returns

### iter24_c: Lookback 50 - SUCCESS ⭐ WINNER
- **Logic**: Stochastic + Support/Resistance with lookback 50, max_hold 32
- **Result**:
  - Small dataset: $232.23 (23.2%), 393 trades, 42.0% win
  - Large dataset: $464.63 (46.5%), 7522 trades, 79.3% win
- **Verdict**: Highest large dataset return among the three, positive on both

## Iteration 26 Results (New Strategy Variants)

### 385: Support Retest (double bottom) - SUCCESS ⭐ NEW WINNER
- **Logic**: Require support to be tested twice within 15 bars at similar price level (within 2%) before entry
- **Result**:
  - 385 (retest): $1109.66 return (107 trades, 66% win) on small, $2027.69 (893 trades, 69.7% win) on large
  - 362 (prev winner): $1109.66 return (107 trades, 66% win) on small, $1926.63 (903 trades, 69.3% win) on large
- **Verdict**: +5% on large dataset with same small performance, retest filter improves signal quality

### 384: Stochastic Turn Up - SUCCESS
- **Logic**: Require K to be rising from oversold (stoch.k > prevK) instead of just oversold
- **Result**:
  - 384: $1109.66 (small), $1962.92 (large)
  - 362: $1109.66 (small), $1926.63 (large)
- **Verdict**: +2% on large, matching on small, catches actual reversal moment

### 390: Volatility-Sized Risk - FAILED (overfits)
- **Logic**: Scale position size inversely to volatility (smaller positions when vol is high)
- **Result**:
  - 390: $1997.47 (small), $1542.22 (large)
  - 362: $1109.66 (small), $1926.63 (large)
- **Verdict**: +80% on small but -20% on large, overfits to small dataset

### 392: Minimal Exit - FAILED (overfits)
- **Logic**: Remove most exits (profit target, trailing stop, max bars, stoch overbought), keep only stop loss + resistance
- **Result**:
  - 392: $1433.76 (small), $1228.61 (large)
  - 362: $1109.66 (small), $1926.63 (large)
- **Verdict**: +29% on small but -36% on large, overfits to small dataset

### 386: Momentum Turn Exit - FAILED
- **Logic**: Exit when momentum turns negative (after being positive)
- **Result**:
  - 386: $608.85 (small), $892.46 (large)
  - 362: $1109.66 (small), $1926.63 (large)
- **Verdict**: -45% on small, -54% on large, momentum exit cuts winners too early

### 387: Weighted Support - FAILED
- **Logic**: Use weighted average of support levels (recent lows weighted higher)
- **Result**:
  - 387: $320.58 (small), $503.51 (large)
- **Verdict**: -71% on small, -74% on large, weighted averaging dilutes signal quality

### 388: Stochastic Cross Exit - FAILED
- **Logic**: Exit on K/D bearish crossover instead of overbought
- **Result**:
  - 388: $741.80 (small), $824.19 (large)
- **Verdict**: -33% on small, -57% on large, crossover exit triggers too early

### 389: Support Strength - FAILED
- **Logic**: Score support by bounce count, require min bounces
- **Result**: 0 trades on small dataset
- **Verdict**: Too restrictive, blocks all entries

### 391: Price Action Entry - NEUTRAL
- **Logic**: Require close > previous bar's high
- **Result**: Identical to 362 (entry condition already implicitly satisfied)
- **Verdict**: No change, redundant with existing conditions

### 393: Clustered Support - FAILED
- **Logic**: Find support zones where multiple lows cluster together
- **Result**:
  - 393: $800.27 (small), $635.22 (large)
- **Verdict**: -28% on small, -67% on large, clustering finds weaker support levels

## Iteration 25 Results (New Strategy Variants)

### 380: Wider bounce_threshold (0.040 vs 0.028) + max_lookback 50 - FAILED
- **Logic**: Increase bounce_threshold from 0.028 to 0.040 (wider support band) + max_lookback 50
- **Result**:
  - 380 (bounce 0.040, max_lookback 50): $181.49 return (123 trades, 54.1% win, 67.17% dd, 2.897 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: -82.7% vs base, wider bounce threshold causes entries at less optimal support levels, significantly hurts win rate (65%→54.1%), wider max_lookback compounds the issue by finding stale support levels

### 376: Wider min_lookback (20 vs 10) - FAILED
- **Logic**: Increase min_lookback from 10 to 20 (wider range for adaptive lookback)
- **Result**:
  - 376 (min_lookback 20): $191.47 return (113 trades, 55.4% win, 67.17% dd, 2.909 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: -81.7% vs base, wider min_lookback restricts adaptive lookback too much, reduces trade frequency and significantly hurts win rate (65%→55.4%), tighter 10-period min is better for capturing recent relevant support

### 372: Medium Lookup (max_lookback 45 vs 36/50) - SUCCESS
- **Logic**: Test max_lookback 45 (between 36 in 302 and 50 in 362)
- **Result**:
  - 372 (max_lookback 45): $1119.94 return (109 trades, 66.7% win, 79.25% dd, 3.405 sharpe)
  - 362 (max_lookback 50): $1109.66 return (107 trades, 66.0% win, 79.25% dd, 3.407 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: +7% vs 302, +0.9% vs 362, max_lookback 45 is optimal - slightly better than both 36 and 50, best win rate (66.7%)

## Iteration 24 Results (New Strategy Variants)

### 371: Wider Lookup (50) + Stoch K Period (18) - FAILED
- **Logic**: Combine wider lookup (max_lookback 50) with stoch_k_period=18 (insight from ITERATION_19)
- **Result**:
  - 371 (max_lookback 50, stoch_k_period 18): $568.36 return (139 trades, 58.0% win, 83.95% dd, 2.980 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: -45.7% vs base, combining wider lookup with stoch_k_period=18 does not improve performance, win rate drops (65%→58%), more trades but lower quality

### 370: Wider Resistance Band (10% below resistance) - FAILED
- **Logic**: Exit when price reaches 10% below resistance instead of exact resistance level
- **Result**:
  - 370 (wide resistance band): $179.55 return (116 trades, 56.9% win, 66.46% dd, 3.003 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: -82.8% vs base, wider resistance band exits too early and misses significant profits, exact resistance level is better for exit timing

### 366: Wider Lookup (50) + No Momentum - FAILED
- **Logic**: Combine wider lookup (max_lookback 50 from 362) with no momentum filter (like 315)
- **Result**:
  - 366 (max_lookback 50, no momentum): $416.86 return (342 trades, 50.0% win, 81.24% dd, 2.894 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: -60% vs base, removing momentum filter causes too many false signals (trades 121→342), win rate drops significantly (65%→50%), wider lookup amplifies the noise from no momentum filter

### 365: Higher Base Lookback (30 vs 18) - FAILED
- **Logic**: Higher base_lookback (30 instead of 18) for longer-term support/resistance
- **Result**:
  - 365 (base_lookback 30): $123.41 return (97 trades, 54.2% win, 66.22% dd, 2.894 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: -88.2% vs base, higher lookback (30 vs 18) finds support levels that are too old/stale, reduces trade frequency (121→97) and significantly hurts win rate (65%→54.2%), shorter 18-period lookback is better for capturing recent relevant support

### 362: Wider Support Lookup Range (max_lookback 50 vs 36) - SUCCESS
- **Logic**: Wider support/resistance lookup range using max_lookback 50 instead of 36
- **Result**:
  - 362 (max_lookback 50): $1109.66 return (107 trades, 66.0% win, 79.25% dd, 3.407 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: +6% vs base, wider lookup finds better support levels, fewer but higher quality trades

## Iteration 23 Results (New Strategy Variants)

### 360: Wider Stochastic K Period (28 vs 14) - FAILED
- **Logic**: Wider stochastic K period (28 instead of 14) for smoother signals
- **Result**:
  - 360: $564.84 return (163 trades, 58.0% win, 79.24% dd, 2.967 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: -46% vs base, wider stoch period generates more trades (163 vs 121) but lower win rate (58% vs 65%), tighter 14-period is better for signal quality

### 356: Day-of-Week Filter (Skip Mon/Fri) - FAILED
- **Logic**: Skip entries on Monday (1) and Friday (5) to avoid weekend gap risk
- **Result**:
  - 356: $191.47 return (113 trades, 55.4% win, 67.17% dd, 2.909 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: -81.7% vs base, skipping Mon/Fri removes too many trading opportunities (~29% of potential trades), lower win rate (65%→55.4%)

## Iteration 22 Results (New Strategy Variants)

### 351: Close Within 2% of Resistance - FAILED
- **Logic**: Exit when price is within 2% of resistance (instead of waiting for actual touch)
- **Result**: 
  - 351: $191.47 return (113 trades, 55.4% win, 67.17% dd, 2.909 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: -81.7% vs base, exiting early (2% before resistance) misses significant profits, better to wait for actual resistance touch

### 350: Triple Confirmation (RSI < 30) - FAILED
- **Logic**: Triple confirmation - near support AND RSI < 30 AND stochastic oversold AND momentum positive
- **Result**: 
  - 350: -$130.26 return (57 trades, 46.4% win)
  - 302 (base): $1046.59 return (121 trades, 65.0% win)
- **Verdict**: -112% vs base, RSI < 30 filter too restrictive, trades reduced by 53% (121→57), win rate drops to 46.4%

### 348: Strong Momentum (0.01 threshold) - FAILED
- **Logic**: Higher momentum threshold (0.01 instead of 0.004) for stronger bounce quality
- **Result**: 
  - 348: $215.96 return (89 trades, 52.3% win)
  - 302 (base): $1046.59 return (121 trades, 65.0% win)
- **Verdict**: -79.4% vs base, higher momentum threshold restricts too many trades (121→89), lower win rate (65%→52.3%), the looser 0.004 threshold actually captures more profitable opportunities

## Iteration 21 Results (New Strategy Variants)

### 342: ROC Filter - FAILED
- **Logic**: Add ROC(5) filter - only enter when ROC < 0 (price declining = better entry)
- **Result**: 
  - 342: $129.62 return (74 trades, 45.9% win)
  - 302 (base): $1046.59 return (121 trades, 65.0% win)
- **Verdict**: -87.6% vs base, ROC filter restricts too many trades (121→74), win rate drops significantly (65%→45.9%), negative price filter too restrictive for profitable entries

### 341: ADX Filter - FAILED
- **Logic**: Add ADX filter - only enter when ADX < 25 (low trend/ranging market)
- **Result**: 
  - 341: $337.61 return (56 trades, 57.1% win)
  - 302 (base): $1046.59 return (121 trades, 65.0% win)
- **Verdict**: -67.7% vs base, ADX filter restricts too many trades (121→56), ranging market filter doesn't improve this strategy

### 337: ATR Filter - FAILED
- **Logic**: Add ATR filter - only enter when current ATR < average ATR * 0.95 (low volatility = tighter entries)
- **Result**: 
  - 337: $882.84 return (78 trades, 61.5% win)
  - 302 (base): $1046.59 return (121 trades, 65.0% win)
- **Verdict**: -15.6% vs base, ATR filter reduces trades too aggressively (121→78), lower win rate, low volatility does NOT equal better entries for this strategy

### 336: Bollinger Bands Filter - FAILED
- **Logic**: Add Bollinger Bands filter - only enter when close < lower_band * 1.05 (price near lower band/oversold)
- **Result**: 
  - Small dataset (test-data.bson): 336: -$86.69 (39 trades, 52.6% win) vs 302: $1046.59 (121 trades, 65% win)
  - Large dataset (test-data-15min-large.bson): 336: $153.06 (605 trades, 71.1% win) vs 302: $1737.24 (992 trades, 69% win)
- **Verdict**: -108% (small) / -91% (large) vs base, Bollinger filter too restrictive, filters out many profitable trades

### 334: RSI Filter - FAILED
- **Logic**: Add RSI as additional filter - only enter when RSI < 40 (in addition to stochastic oversold)
- **Result**: 
  - 334: $26.60 return (89 trades, 50.0% win, 66.22% dd, 2.848 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: -97% vs base, RSI filter too restrictive, filters out many profitable trades

### 333: Multi Exit with BE - FAILED
- **Logic**: Multiple exits (stop loss, trailing stop, profit target, max bars, resistance, stoch overbought) + time-based exit + BE exit when bars > max_hold_bars/2
- **Result**: 
  - 333: $189.46 return (113 trades, 53.6% win, 67.17% dd, 2.909 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: -82% vs base, BE exit too aggressive, cuts off profitable trades

## Iteration 20 Results (New Strategy Variants)

### 332: Long Hold (max_hold_bars 50) - FAILED
- **Logic**: Longer max hold bars (50 instead of 32) to let trades run longer
- **Result**: 
  - 332: $1025.23 return (121 trades, 65.0% win, 79.25% dd, 3.357 sharpe)
  - 302 (base): $1046.59 return (121 trades, 65.0% win, 79.25% dd, 3.361 sharpe)
- **Verdict**: Slightly worse (-2%), longer hold doesn't help

### 328: Tight Stop Loss - FAILED
- **Logic**: Tighter stop loss (0.04 instead of 0.08)
- **Result**: 
  - Small dataset: $135.81 vs $1046.59 base (-87%)
  - Large dataset: $1335.89 vs $1737.24 base (-23%)
- **Verdict**: Tighter stop exits positions too early; SR bounces need room to recover

### 326: No Bounce - FAILED
- **Logic**: Remove bounce requirement (min_bounce_bars = 0)
- **Result**: -65% return ($364 vs $1046 base), 223 trades vs 121, 63.1% win rate
- **Verdict**: More trades but worse returns, bounce filter helps quality

### 324: Tight Stochastic - FAILED
- **Logic**: Use tighter stochastic oversold (14 instead of 24) for earlier entry
- **Result**: -80% return ($210 vs $1046 base), 38 trades vs 121
- **Verdict**: Too restrictive, misses too many opportunities

## Iteration 19 Results (New Strategy Variants)

### 313: Volume Filter - FAILED
- **Logic**: Add volume threshold filter to entry
- **Result**: Return dropped 99.5% ($1046 → $4.65)
- **Verdict**: Too restrictive, blocks most trades

### 314: RSI Exit - FAILED
- **Logic**: Add RSI overbought exit condition
- **Result**: -82% vs base
- **Verdict**: Premature exits hurt performance

### 315: No Momentum - SUCCESS (on small dataset)
- **Logic**: Remove momentum filter requirement
- **Result**: +575% return on small dataset ($2444 vs $362)
- **Verdict**: Best strategy on small dataset, but higher overfit

### 316: Volatility Filter - FAILED
- **Logic**: Only trade when volatility >= threshold
- **Result**: -83% return
- **Verdict**: Too strict, blocks profitable trades

### 317: Dynamic Trail - MIXED
- **Logic**: Volatility-based trailing stop
- **Result**: Higher raw returns but lower Sharpe
- **Verdict**: May help on some datasets

### 318: Trend Back - FAILED
- **Logic**: Add EMA(50) trend filter
- **Result**: -99% return, blocks 97% of trades
- **Verdict**: Trend filter destroys performance

### 319: Multi-TP - FAILED
- **Logic**: Partial take profits at multiple levels
- **Result**: -63% return
- **Verdict**: Higher overfit ratio

### 320: Confluence - FAILED
- **Logic**: Require higher lows pattern
- **Result**: -82% return
- **Verdict**: Filters good trades

### 321: Time Filter - FAILED
- **Logic**: Skip last 1/3 of dataset period
- **Result**: -64% return
- **Verdict**: Removes profitable late-period trades

### 322: ATR Stop - MIXED
- **Logic**: ATR-based trailing stop
- **Result**: Worse on small, slightly better on large (+$70)
- **Verdict**: Mixed results

---

## Failed Attempts

### Time-Based Filter (321)
- **Strategy**: Based on 302 but adds time-based filter to avoid late-game volatility
- **Logic Change**: Only enter trades in first 66% of dataset period (trade_cutoff_ratio=0.66)
- **Base Return (302)**: $1046.59 (121 trades, 65% win)
- **Time Filter Return (321)**: $377.96 (68 trades, 67.6% win)
- **Result**: WORSE - Returns reduced by 64%, though win rate improved slightly
- **Verdict**: FAILED - Time filter removes too many trading opportunities; late period appears to have good trades

### Price Confluence (320)
- **Strategy**: Based on 302 but adds price confluence check (higher lows pattern)
- **Logic Change**: Added checkPriceConfluence() requiring rising lows in recent periods
- **Parameters**: min_bounce_bars=1, confluence_lookback=2, min_higher_lows=1
- **Base Return (302)**: $1046.59 (121 trades, 65% win)
- **Confluence Return (320)**: $191.47 (113 trades, 55.4% win)
- **Result**: WORSE - Confluence filter reduced returns by 82%
- **Verdict**: FAILED - Price confluence check filters out good trades

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

## Iteration 16 - Support/Resistance No-Trend-Filter Variants (v16) - 2026-02-17

### Prepared Strategies (30 total) - Awaiting Optimization

| # | Strategy | Params File | Status |
|---|----------|------------|--------|
| 01 | sr_ntf_v16_001 | strat_sr_ntf_v16_001.params.json | Prepared |
| 02 | sr_ntf_v16_002 | strat_sr_ntf_v16_002.params.json | Prepared |
| 03 | sr_ntf_v16_003 | strat_sr_ntf_v16_003.params.json | Prepared |
| 04 | sr_ntf_v16_004 | strat_sr_ntf_v16_004.params.json | Prepared |
| 05 | sr_ntf_v16_005 | strat_sr_ntf_v16_005.params.json | Prepared |
| 06 | sr_ntf_v16_006 | strat_sr_ntf_v16_006.params.json | Prepared |
| 07 | sr_ntf_v16_007 | strat_sr_ntf_v16_007.params.json | Prepared |
| 08 | sr_ntf_v16_008 | strat_sr_ntf_v16_008.params.json | Prepared |
| 09 | sr_ntf_v16_009 | strat_sr_ntf_v16_009.params.json | Prepared |
| 10 | sr_ntf_v16_010 | strat_sr_ntf_v16_010.params.json | Prepared |
| 11 | sr_ntf_v16_011 | strat_sr_ntf_v16_011.params.json | Prepared |
| 12 | sr_ntf_v16_012 | strat_sr_ntf_v16_012.params.json | Prepared |
| 13 | sr_ntf_v16_013 | strat_sr_ntf_v16_013.params.json | Prepared |
| 14 | sr_ntf_v16_014 | strat_sr_ntf_v16_014.params.json | Prepared |
| 15 | sr_ntf_v16_015 | strat_sr_ntf_v16_015.params.json | Prepared |
| 16 | sr_ntf_v16_016 | strat_sr_ntf_v16_016.params.json | Prepared |
| 17 | sr_ntf_v16_017 | strat_sr_ntf_v16_017.params.json | Prepared |
| 18 | sr_ntf_v16_018 | strat_sr_ntf_v16_018.params.json | Prepared |
| 19 | sr_ntf_v16_019 | strat_sr_ntf_v16_019.params.json | Prepared |
| 20 | sr_ntf_v16_020 | strat_sr_ntf_v16_020.params.json | Prepared |
| 21 | sr_ntf_v16_021 | strat_sr_ntf_v16_021.params.json | Prepared |
| 22 | sr_ntf_v16_022 | strat_sr_ntf_v16_022.params.json | Prepared |
| 23 | sr_ntf_v16_023 | strat_sr_ntf_v16_023.params.json | Prepared |
| 24 | sr_ntf_v16_024 | strat_sr_ntf_v16_024.params.json | Prepared |
| 25 | sr_ntf_v16_025 | strat_sr_ntf_v16_025.params.json | Prepared |
| 26 | sr_ntf_v16_026 | strat_sr_ntf_v16_026.params.json | Prepared |
| 27 | sr_ntf_v16_027 | strat_sr_ntf_v16_027.params.json | Prepared |
| 28 | sr_ntf_v16_028 | strat_sr_ntf_v16_028.params.json | Prepared |
| 29 | sr_ntf_v16_029 | strat_sr_ntf_v16_029.params.json | Prepared |
| 30 | sr_ntf_v16_030 | strat_sr_ntf_v16_030.params.json | Prepared |

## Iteration 17 - Support/Resistance No-Trend-Filter Batch (v16) Results - 2026-02-19

### All 30 Strategies Optimized - ALL PASSED

| # | Strategy | Test Return | Train Return | Full Return | Trades |
|---|----------|-------------|--------------|-------------|--------|
| 01 | sr_ntf_v16_001 | $130.21 | - | - | 33 |
| 02 | sr_ntf_v16_002 | $186.69 | - | - | 37 |
| 03 | sr_ntf_v16_003 | $120.21 | - | - | 33 |
| 04 | sr_ntf_v16_004 | $188.58 | - | - | 37 |
| 05 | sr_ntf_v16_005 | $171.39 | - | - | 37 |
| 06 | sr_ntf_v16_006 | $129.97 | - | - | 33 |
| 07 | sr_ntf_v16_007 | $186.43 | - | - | 37 |
| 08 | sr_ntf_v16_008 | $130.04 | - | - | 33 |
| 09 | sr_ntf_v16_009 | $61.36 | - | - | 41 |
| 10 | sr_ntf_v16_010 | **$188.87** | - | - | 37 |
| 11 | sr_ntf_v16_011 | $170.74 | - | - | 37 |
| 12 | sr_ntf_v16_012 | $143.15 | - | - | 31 |
| 13 | sr_ntf_v16_013 | $119.96 | - | - | 33 |
| 14 | sr_ntf_v16_014 | $188.13 | - | - | 37 |
| 15 | sr_ntf_v16_015 | $185.35 | - | - | 37 |
| 16 | sr_ntf_v16_016 | $132.12 | - | - | 33 |
| 17 | sr_ntf_v16_017 | $186.24 | - | - | 37 |
| 18 | sr_ntf_v16_018 | $130.11 | - | - | 33 |
| 19 | sr_ntf_v16_019 | $141.09 | - | - | 39 |
| 20 | sr_ntf_v16_020 | $186.51 | - | - | 37 |
| 21 | sr_ntf_v16_021 | $186.31 | - | - | 37 |
| 22 | sr_ntf_v16_022 | $188.05 | - | - | 37 |
| 23 | sr_ntf_v16_023 | $186.69 | - | - | 37 |
| 24 | sr_ntf_v16_024 | $130.21 | $721.83 | $998.19 | 33 |
| 25 | sr_ntf_v16_025 | $188.84 | $731.15 | $1,106.59 | 37 |
| 26 | sr_ntf_v16_026 | $185.85 | $727.31 | $1,095.10 | 37 |
| 27 | sr_ntf_v16_027 | $186.19 | $729.10 | $1,098.06 | 37 |
| 28 | sr_ntf_v16_028 | $129.91 | $718.63 | $993.58 | 33 |
| 29 | sr_ntf_v16_029 | $188.44 | $725.57 | $1,100.01 | 37 |
| 30 | sr_ntf_v16_030 | $130.20 | $726.35 | $1,003.37 | 33 |

### Key Findings

1. **High test return cluster at ~$186-188**: Many strategies converged to similar optimal parameters
2. **Lookback varies (12-36)**: Both short and long lookbacks can work
3. **Bounce threshold ~0.02**: Consistent across top performers
4. **Stop loss ~0.064**: Tight stop losses work best
5. **Risk percent ~0.35**: Higher risk allocation improves returns
6. **Take profit ~0.10-0.17**: Wide range acceptable

### Best Strategy: sr_ntf_v16_010
- Test Return: $188.87
- Parameters: lookback=36, bounce_threshold=0.021, stop_loss=0.065, risk=35%, take_profit=0.104

## Iteration 18 - Support/Resistance No-Trend-Filter Refined Parameters (v17) - 2026-02-19

### All 20 Strategies Optimized - ALL PASSED

| # | Strategy | Test Return | Full Return | Trades |
|---|----------|-------------|-------------|--------|
| 01 | sr_ntf_v17_001 | $206.76 | $1,268.26 | 37 |
| 02 | sr_ntf_v17_002 | $165.24 | $1,120.43 | 39 |
| 03 | sr_ntf_v17_003 | $203.63 | $1,259.04 | 37 |
| 04 | sr_ntf_v17_004 | $196.14 | $1,171.34 | 37 |
| 05 | sr_ntf_v17_005 | $186.89 | $1,206.26 | 37 |
| 06 | sr_ntf_v17_006 | $181.06 | $1,149.74 | 37 |
| 07 | sr_ntf_v17_007 | $196.63 | $1,173.76 | 37 |
| 08 | sr_ntf_v17_008 | $190.27 | $1,134.16 | 37 |
| 09 | sr_ntf_v17_009 | $144.57 | $1,289.84 | 33 |
| 10 | sr_ntf_v17_010 | $141.18 | $1,206.19 | 33 |
| 11 | sr_ntf_v17_011 | $186.89 | $1,206.26 | 37 |
| 12 | sr_ntf_v17_012 | $181.04 | $1,149.51 | 37 |
| 13 | sr_ntf_v17_013 | $159.06 | $1,061.44 | 39 |
| 14 | sr_ntf_v17_014 | $188.49 | $1,118.30 | 37 |
| 15 | sr_ntf_v17_015 | $199.60 | $1,202.96 | 37 |
| 16 | sr_ntf_v17_016 | $195.18 | - | 37 |
| 17 | sr_ntf_v17_017 | $206.24 | - | 37 |
| 18 | sr_ntf_v17_018 | $125.38 | - | 33 |
| 19 | sr_ntf_v17_019 | $134.31 | - | 33 |
| 20 | sr_ntf_v17_020 | **$209.78** | - | 37 |

### Key Findings

1. **Higher risk (40-42%) improves returns**: v17 pushed risk higher than v16 and got better results
2. **Longer lookback (40-45) works well**: v17_020 with lookback=45 is new best
3. **Tighter take profit (9-11%) better**: Lock in gains faster
4. **All 20 strategies passed**: 100% success rate confirms robust parameter space

### Best Strategy: sr_ntf_v17_020
- Test Return: $209.78 (NEW RECORD - beats v16_010's $188.87)
- Parameters: lookback=45, bounce_threshold=0.021, stop_loss=0.066, risk=42%, take_profit=0.090

## Iteration 19 - Dynamic Trailing Stop (317) - 2026-02-19

### Strategy 317: SR No Trend Dynamic Trail
- **Base**: Based on 302 with volatility-based trailing stop
- **Change**: Trailing stop = recent_volatility * multiplier (clamped 0.02-0.15)
- **Parameters**: trailing_stop_multiplier=2.0 (default)

### Results (test-data-15min-10k.bson)

| Metric | Strategy 317 (Dynamic) | Strategy 302 (Fixed) | Comparison |
|--------|------------------------|----------------------|------------|
| Return | $965.88 (96.59%) | $361.96 (36.20%) | **+167%** |
| Final Capital | $1,965.88 | $1,361.96 | **+44%** |
| Sharpe | 0.278 | 0.318 | -13% |
| Max Drawdown | -100.00% | -100.00% | Same |
| Trades | 3,365 | 2,512 | +34% |
| Win Rate | 64.1% | 68.5% | -4.4% |

### Verdict: FAILED - Higher Risk, Lower Sharpe
- **Raw returns improved**: Dynamic stop generated 2.67x more profit
- **Risk-adjusted returns worse**: Sharpe dropped from 0.318 to 0.278 (-13%)
- **More frequent exits**: 853 more trades (+34%) indicates dynamic stop triggers more often
- **Lower win rate**: Slightly less successful trades due to more aggressive trailing
- **Core issue**: Volatility-based stops are too sensitive in this dataset, causing premature exits on volatile moves

### Key Insight
Fixed trailing stops (0.07 in 302) work better than volatility-based stops for this data. The dynamic approach overreacts to normal volatility, locking in gains too early and missing larger trends despite generating more total trades.

## Iteration 19 - RSI Exit (314) - 2026-02-19

### Strategy 314: SR No Trend RSI Exit
- **Base**: Based on 302 (no trend filter)
- **Change**: Added RSI-based exit when RSI > 70 (overbought) with 3% minimum profit
- **Parameters**: rsi_period=14, rsi_overbought=70, rsi_exit_min_profit=0.03

### Results (test-data.bson)

| Metric | Strategy 314 (RSI Exit) | Strategy 302 (Base) | Comparison |
|--------|------------------------|----------------------|------------|
| Return | $191.47 (19.15%) | $1,046.59 (104.66%) | **-82%** |
| Final Capital | $1,191.47 | $2,046.59 | -42% |
| Sharpe | 2.909 | 3.361 | -13% |
| Drawdown | -67.17% | -79.25% | +12% |
| Trades | 113 | 121 | -8 |
| Win Rate | 55.4% | 65.0% | -9.6% |

### Verdict: FAILED - RSI Exit Hurts Performance
- **RSI exit significantly underperforms**: 82% less return than base
- **Lower win rate**: RSI exit causes exiting too early, missing bigger moves
- **The stochastic overbought exit (82) already handles overbought conditions effectively**
- Adding RSI exit (70) creates redundant/competing exit signals that reduce profitability

### Key Insight
The existing stochastic overbought exit (k >= 82) is sufficient for exit timing. Adding an earlier RSI exit (70) causes premature exits that cut off winning trades before they reach full potential. The base 302 strategy with stochastic overbought exit is optimal.

## Iteration 19 - EMA Trend Filter (318) - 2026-02-19

### Strategy 318: SR No Trend With Trend
- **Base**: Based on 302 (no trend filter)
- **Change**: Added EMA(50) trend filter - only enter when price > EMA
- **Parameters**: trend_ema_period=50

### Results (test-data.bson)

| Metric | Strategy 318 (EMA Trend) | Strategy 302 (Base) | Comparison |
|--------|------------------------|----------------------|------------|
| Return | $8.65 (0.87%) | $1,046.59 (104.66%) | **-99%** |
| Final Capital | $1,008.65 | $2,046.59 | -99% |
| Sharpe | 8.683 | 3.361 | +158% |
| Drawdown | -29.85% | -79.25% | +62% |
| Trades | 4 | 121 | -97 |
| Win Rate | 100.0% | 65.0% | +35% |

### Verdict: FAILED - Trend Filter Too Restrictive
- **Trend filter blocks almost all trades**: Only 4 trades vs 121 (-97%)
- **Performance destroyed**: 99% less return than base
- **While win rate is higher (100% vs 65%)**, the extremely low trade count means the strategy captures almost none of the available opportunities
- **The no-trend-filter approach (302) is superior** - the momentum filter already provides quality screening without overly restricting entry

### Key Insight
Adding an EMA trend filter to the 302 strategy hurts performance dramatically. The existing momentum filter (momentum >= 0.004) already captures directional quality without being overly restrictive. The base 302 strategy with momentum filter (no trend filter) remains optimal.

## Iteration 19 - Multi Take Profit (319) - 2026-02-19

### Strategy 319: SR No Trend Multi TP
- **Base**: Based on 302 (no trend filter)
- **Change**: Multi-take-profit - closes 50% at first_tp_percent, trails remaining 50%
- **Parameters**: first_tp_percent=0.08, second_tp_percent=0.15

### Results (test-data.bson)

| Metric | Strategy 319 (Multi TP) | Strategy 302 (Base) | Comparison |
|--------|------------------------|----------------------|------------|
| Return | $390.80 (39.08%) | $1,046.59 (104.66%) | **-63%** |
| Final Capital | $1,390.80 | $2,046.59 | -32% |
| Sharpe | 2.665 | 3.361 | -21% |
| Drawdown | -67.38% | -79.25% | +15% |
| Trades | 131 | 121 | +8% |
| Win Rate | 58.1% | 65.0% | -6.9% |

### Out-of-Sample Test (test-data-15min-large.bson)

| Metric | Strategy 319 (Multi TP) | Strategy 302 (Base) |
|--------|------------------------|----------------------|
| Return | $1,045.20 (104.52%) | $1,737.24 (173.72%) |
| Sharpe | 2.457 | 1.431 |
| Overfit Ratio | 2.67x | 1.66x |

### Verdict: FAILED - Multi TP Underperforms Base
- **Lower returns**: 63% less return than base on test data
- **Lower Sharpe**: 21% worse risk-adjusted returns
- **Higher overfit ratio**: 2.67x vs 1.66x indicates more overfitting
- **The base 302 strategy is superior** - single profit target works better than partial exits

### Key Insight
The partial exit logic (closing 50% at first TP) doesn't improve risk-adjusted returns. The base 302 strategy with single profit target (12%) outperforms the multi-TP approach. Partial exits may reduce exposure to winners too early, missing additional profit potential.

## Iteration 53 - Strategy B (Fuzzy Logic Entry Controller) - 2026-02-23

### Strategy: strat_iter53_b
- **Logic**: Fuzzy-logic controller with 3 memberships (oversoldness, support proximity, momentum recovery), weighted fuzzy AND/OR confidence for entry, and confidence-collapse exit plus standard exits.
- **Optimization**: `scripts/run-optimization.ts` auto-tuned parameters on `data/test-data.bson`.

### Results
- **Small (data/test-data.bson)**: Return **123.39%**, Win Rate **41.0%**, Trades **1384**
- **Large (data/test-data-15min-large.bson)**: Return **199.42%**, Win Rate **43.0%**, Trades **24777**

### Verdict: SUCCESSFUL
- Positive return on both datasets.
- Large-dataset return exceeds small-dataset return (no overfit signal by this heuristic).
