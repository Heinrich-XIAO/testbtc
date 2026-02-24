# ITERATION 32 - Novel Logic Round

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter32_a` | ATR regime gate + stochastic support entry | +43.72% | +90.44% | 31.9% / 32.6% | 94 / 1235 | ✅ Winner |
| B | `strat_iter32_b` | RSI divergence proxy + stochastic support entry | +34.90% | -4.52% | 37.5% / 27.0% | 24 / 233 | ❌ Overfit |
| C | `strat_iter32_c` | MACD histogram acceleration + weakening exit | +2.04% | +0.89% | 50.0% / 44.0% | 4 / 100 | ⚠️ Low sample size |

## Subagent Actions

- **Strategy A (`strat_iter32_a`)**: Implemented ATR(14)/close regime filtering to allow entries only in lower-volatility conditions, then required stochastic cross-up near support. Kept exits simple (SL/PT/resistance/max-hold). Optimizer tuned parameters and produced the strongest large-dataset gain this round.
- **Strategy B (`strat_iter32_b`)**: Implemented a bullish-divergence proxy (recent lower low in price while RSI rises across recent bars) on top of stochastic support entry. Backtest degraded hard out-of-sample.
- **Strategy C (`strat_iter32_c`)**: Implemented MACD histogram sign-cross plus acceleration check, with an extra weakening-momentum early-exit condition. Logic is novel but currently too sparse on the small dataset.

## Hopeless / Discarded

- `strat_iter32_b`: negative on large dataset.
- `strat_iter32_c`: technically positive on both, but only 4 trades on small dataset so not a robust winner.

## Key Insights

1. Regime filtering with ATR can materially improve generalization when combined with existing support/stochastic structure.
2. Divergence proxies can look good in-sample but fail quickly out-of-sample if signal frequency is low.
3. MACD histogram acceleration is promising as an entry primitive, but needs trade-frequency controls to reach statistical significance.

## Comparison to Best Known Strategy

- Prior all-time large return in this branch: `iter20_a` at +94.3% large.
- New contender: `iter32_a` at +90.44% large and +43.72% small (large >= small and >15 small trades), making it a valid winner candidate.
