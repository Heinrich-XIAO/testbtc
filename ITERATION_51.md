# ITERATION 51 - Genetic Fitness Proxy / Entropy Chaos Filter / Fractal Cycle Phase

**Date:** 2026-02-24
**Phase:** Phase 4 - Validation (Crazy Concepts)
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter51_a` | Genetic fitness score combining RSI, Stoch, MA, ATR, momentum with weighted scoring | +1752.5% | +1156.9% | 36.5% / 37.9% | 836 / 9106 | ⚠️ High volatility |
| B | `strat_iter51_b` | Shannon entropy filter for low-chaos entry conditions | +550.5% | +404.9% | 39.8% / 42.0% | 1610 / 27491 | ⚠️ High volatility |
| C | `strat_iter51_c` | Autocorrelation-based fractal cycle detection with phase entry | +4.9% | +56.7% | 27.2% / 36.8% | 92 / 1707 | ✅ Robust |

## Subagent Actions

- **`strat_iter51_a`**: Implemented multi-factor "genetic" fitness scoring system that weights RSI oversold, stochastic oversold, price below MA, low ATR ratio, and positive momentum. Entry when fitness score exceeds threshold near support.
- **`strat_iter51_b`**: Implemented Shannon entropy-based chaos filter. Entry when entropy of recent returns is low (price behavior is orderly), stochastic is oversold, and price is near support.
- **`strat_iter51_c`**: Implemented autocorrelation-based dominant cycle detection. Entry when price is in trough phase of detected cycle near support with upward momentum.

## Hopeless / Discarded

- None outright failed, but `strat_iter51_a` and `strat_iter51_b` have extreme drawdown characteristics indicating potential risk management issues.

## Key Insights

1. **Multi-factor fitness scoring (A)** generates many trades and high returns but with extreme volatility (max drawdown > 8000%). The compounding effect of frequent trades amplifies both gains and losses.

2. **Entropy filter (B)** successfully identifies low-chaos periods for entry. The high trade count and reasonable win rate suggest it captures valid signals, but risk management needs work.

3. **Fractal cycle detection (C)** is the most conservative and robust. Lower trade count but positive returns on both datasets with better risk characteristics. The autocorrelation approach successfully identifies cyclic price behavior.

4. **Winner criteria**: Only strategy C passes as a "winner" - it has positive returns on both datasets (4.9% small, 56.7% large), large return >= small return, and sufficient trades (>15 on small).

## Comparison to Best Known Strategy

- Best known reference (`iter33_a`): +54.15% small, +129.96% large.
- Best in this iteration: `strat_iter51_c` (+4.9% small, +56.7% large).
- **Winner call:** `strat_iter51_c` passes winner criteria but underperforms the best known.
