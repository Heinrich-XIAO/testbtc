# Polymarket Trading Agent Guidelines

## Runtime

- **NEVER use `node`** - always use `bun` for running scripts
- Example: `bun .cache/run-optimization.js` NOT `node .cache/run-optimization.js`

## Testing Performance

When adding new logic or making changes to the trading strategy:
1. Always parameterize any new logic so it can be easily toggled and tested
2. Always run `bun run optimize --deterministic-slow` to test performance
2. If performance is worse, always revert the changes and add the attempt to ATTEMPTED.md (failed section)
3. If performance is better, add it to ATTEMPTED.md (successful section)

## ATTEMPTED.md

Keep track of all attempts - both successful and failed.

## Strategy

When asked about a trading strategy, default to simple_ma.

## Dataset Policy

- Large candidate dataset file: `data/test-data-15min-large.bson`
- This file is experimental and MUST NOT replace the default optimization dataset until there is explicit evidence that it improves out-of-sample performance and reduces overfitting.
- Required evidence before promoting this dataset:
  - Run optimization/backtest comparisons on both datasets (`data/test-data.bson` vs `data/test-data-15min-large.bson`)
  - Show improved or comparable test returns with better train/test consistency (lower overfit ratio)
  - Record results in `ATTEMPTED.md`
- Once that evidence exists, ALWAYS run optimization/backtests on `data/test-data-15min-large.bson` by default.
