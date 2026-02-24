# ITERATION 33 - Reclaim / Noise / Regime Exits

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter33_a` | False-breakdown reclaim before entry | +54.15% | +129.96% | 21.1% / 23.4% | 123 / 802 | ✅ Winner |
| B | `strat_iter33_b` | Candle-range noise filter on entries | +54.73% | +84.71% | 29.3% / 29.7% | 92 / 1076 | ✅ Winner |
| C | `strat_iter33_c` | RSI regime-switch exit after entry | +36.50% | +109.57% | 26.7% / 30.3% | 120 / 1295 | ✅ Winner |

## Subagent Actions

- **`strat_iter33_a`**: Added reclaim logic where price must first break below support, then reclaim that level within a configurable bar window before a stochastic-based entry is allowed.
- **`strat_iter33_b`**: Added a low-noise gate using recent candle-range ratio to avoid entering during high-volatility/noisy bars.
- **`strat_iter33_c`**: Added RSI regime-aware early exit (dynamic threshold after entry), while preserving baseline risk exits.

## Hopeless / Discarded

- None in this round; all three candidates satisfy positive small+large and large>=small with sufficient trades.

## Key Insights

1. False-break reclaim is a strong direction and currently produced the best large-dataset return in this round.
2. Simple noise filtering on entries can retain upside while reducing poor entry contexts.
3. Regime-aware exits (RSI drop-back) improved out-of-sample performance without adding excessive complexity.

## Comparison to Best Known Strategy

- `iter20_a`: +12.5% small, +94.3% large.
- `iter33_a`: +54.15% small, +129.96% large (new top large-dataset result among recent rounds).
