# ITERATION 157

**Date**: 2026-02-26
**Number of Strategies**: 5
**Phase**: Discovery - Correlation Regimes

## Strategy Summary Table

| Strategy | Logic | Small Return | Large Return | Trades (S/L) | Action | Notes |
|----------|-------|--------------|--------------|--------------|--------|-------|
| 157a | Rolling correlation regime | 47.55% | 31.21% | 24/265 | KEEP | Positive both datasets, low small-sample trades |
| 157b | Correlation breakdown | 11.57% | - | 90/- | DISCARD | Weak edge |
| 157c | Lead-lag proxy | 97.22% | 107.53% | 362/4236 | WINNER | Best robustness and sample size |
| 157d | Cross-scale correlation | 24.51% | 49.99% | 62/775 | KEEP | Stable improvement on large dataset |
| 157e | Correlation momentum | 7.21% | - | 28/- | DISCARD | Weak and sparse |

## Subagent Actions

- **Subagent 157a**: Implemented correlation-regime rebound logic using rolling autocorrelation and horizon correlation spread.
- **Subagent 157b**: Implemented correlation-breakdown detector using rolling correlation instability metrics.
- **Subagent 157c**: Implemented lead-lag rebound logic between fast and slow momentum windows.
- **Subagent 157d**: Implemented cross-scale dislocation detection with short/long normalized move correlations.
- **Subagent 157e**: Implemented correlation-momentum turn detector from depressed correlation states.

## Hopeless/Discarded

- **157b**: Low return and no large-dataset validation edge.
- **157e**: Low return and insufficient sample quality.

## Key Insights

- Correlation structure can be useful when converted into lead-lag transition logic, not only static correlation thresholds.
- Cross-scale dislocation signals are more stable than raw correlation-breakdown triggers.
- Seasonal/correlation hybrids should prefer high-frequency trigger conditions to avoid zero-trade outcomes.

## Comparison to Best Known Strategy

- Iteration winner **157c** achieved **97.22% (small)** and **107.53% (large)**, with large >= small and good trade count.
- This is robust but below top global leaders in this run (e.g., CUSUM/ADF-class winners >700% on large dataset).

## Experimental Notes

- Execution now follows updated user constraint: one subagent strategy task at a time while still completing all 5 strategies before advancing iterations.
