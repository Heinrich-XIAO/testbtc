# ITERATION 156

**Date**: 2026-02-26
**Number of Strategies**: 5
**Phase**: Discovery - Seasonality

## Strategy Summary Table

| Strategy | Logic | Small Return | Large Return | Trades (S/L) | Action | Notes |
|----------|-------|--------------|--------------|--------------|--------|-------|
| 156a | Day-of-week seasonality filter | 0.00% | - | 0/- | DISCARD | No trades generated |
| 156b | Week-of-month seasonality filter | 253.54% | 339.92% | 1565/26880 | KEEP | Strong and consistent on both datasets |
| 156c | Month-of-year seasonality filter | 0.00% | - | 0/- | DISCARD | No trades generated |
| 156d | Quarter-of-year seasonality filter | 0.00% | - | 0/- | DISCARD | No trades generated |
| 156e | Semi-annual seasonality filter | 0.00% | - | 0/- | DISCARD | No trades generated |

## Subagent Actions

- **Subagent 156a**: Implemented weekday-mask based seasonality strategy with stoch + support confirmation and standard risk exits.
- **Subagent 156b**: Implemented week-of-month bias strategy with rolling bucket scoring, stoch + support confirmation and standard risk exits.
- **Subagent 156c**: Implemented month-mask based seasonality strategy with rolling month scores, stoch + support confirmation and standard risk exits.
- **Subagent 156d**: Implemented quarter-mask based seasonality strategy with rolling quarter scores, stoch + support confirmation and standard risk exits.
- **Subagent 156e**: Implemented half-year regime filter with rolling score, stoch + support confirmation and standard risk exits.

## Hopeless/Discarded

- **156a**: Produced zero entries under tested parameter ranges.
- **156c**: Produced zero entries under tested parameter ranges.
- **156d**: Produced zero entries under tested parameter ranges.
- **156e**: Produced zero entries under tested parameter ranges.

## Key Insights

- Week-of-month seasonality (156b) remains exploitable and aligns with strong stoch+support behavior.
- Coarser seasonal filters (month/quarter/semi-annual) are too restrictive in current entry architecture.
- Calendar features are useful only when combined with sufficiently frequent trigger mechanics.

## Comparison to Best Known Strategy

- Current iteration winner: **156b** at **253.54% (small)** and **339.92% (large)**.
- This is strong, but still below top historical large-dataset leaders (e.g., CUSUM/ADF-class winners >700%).

## Experimental Notes

- Execution mode changed per user instruction: strategy generation now uses one subagent call at a time, while still completing all 5 strategies per iteration before advancing.
