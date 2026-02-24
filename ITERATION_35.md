# ITERATION 35 - Touch Confirmation / BE Stop / Vol Contraction

**Date:** 2026-02-23
**Phase:** Phase 4 - Validation
**Number of Strategies:** 3

## Strategy Summary Table

| # | Strategy | Core Novel Logic | Small Return | Large Return | Win Rate (S/L) | Trades (S/L) | Status |
|---|----------|------------------|--------------|--------------|----------------|--------------|--------|
| A | `strat_iter35_a` | Multi-touch support confirmation before entry | +117.91% | +1.50% | 38.2% / 37.3% | 722 / 14188 | ❌ Large collapse |
| B | `strat_iter35_b` | Break-even stop promotion after gain trigger | +31.82% | +36.37% | 39.4% / 38.9% | 348 / 6479 | ✅ Winner |
| C | `strat_iter35_c` | Volatility contraction + failed-expansion exit | 0.00% | 0.00% | 0.0% / 0.0% | 0 / 0 | ❌ No signal |

## Subagent Actions

- **`strat_iter35_a`**: Added support-zone touch counting and required minimum touches before allowing stochastic entry.
- **`strat_iter35_b`**: Added dynamic break-even stop migration (trigger + buffer) while preserving baseline exit stack.
- **`strat_iter35_c`**: Added contraction/reclaim entry and expansion-failure timeout exit, but strategy became too restrictive and produced zero trades.

## Hopeless / Discarded

- `strat_iter35_c`: no trades on either dataset.
- `strat_iter35_a`: massive degradation from small to large despite high in-sample gains.

## Key Insights

1. Break-even stop promotion is a practical, robust enhancement that preserved out-of-sample performance.
2. Support-touch-count confirmation can overfit by forcing too many delayed entries.
3. Volatility-contraction constructs need looser constraints to avoid dead strategies.

## Comparison to Best Known Strategy

- `iter33_a`: +54.15% small, +129.96% large.
- `iter35_b`: +31.82% small, +36.37% large (valid but below current leaders).
